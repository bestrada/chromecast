// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Smooth Streaming manifest parser.
 */

(function() {

  'use strict';

  function str(x) {
    return x;
  }

  function hexStringtoa8(str) {
    var ab = new ArrayBuffer(str.length / 2);
    var u8 = new Uint8Array(ab);
    for (var i = 0; i < str.length; i += 2) {
      u8[i / 2] = parseInt(str.substr(i, 2), 16);
    }
    return u8;
  }

  function parseHexString(str) {
    var a = [];
    for (var i = 0; i < str.length; i += 2) {
      a.push(parseInt(str.substr(i, 2), 16));
    }
    return a;
  }

  // Gets a GUID and returns an a8
  function parseGuid(guid) {
    return hexStringtoa8(guid.replace(/[{}-]/g, ''));
  }

  function parseDuration(dur_str) {
    // Unsupported: date part of ISO 8601 durations
    var re = /PT(([0-9]*)H)?(([0-9]*)M)?(([0-9.]*)S)?/;
    var match = re.exec(dur_str);
    if (!match) return parseFloat(dur_str);
    return (parseFloat(match[2] || 0) * 3600 +
        parseFloat(match[4] || 0) * 60 +
        parseFloat(match[6] || 0));
  }

  function parseChildElements(node_name, parse_func, xml) {
    var result = [];
    if (xml == null) return result;
    for (var child = xml.firstElementChild; child != null;
        child = child.nextElementSibling) {
      if (child.nodeName == node_name) {
        result.push(parse_func(child));
      }
    }
    return result;
  }

  function parseChildElement(node_name, parse_func, xml) {
    return parseChildElements(node_name, parse_func, xml)[0] || null;
  }

  function parseAttributes(attr_map, xml, result) {
    result = result || {};
    for (var k in attr_map) {
      if (xml.attributes.getNamedItem(k) != null)
        result[k] = attr_map[k](xml.attributes[k].value);
    }
    return result;
  }

  function parseCodecPrivateData(c_str) {
    var result = {};
    var parsedString = c_str.split('00000001');
    if (parsedString.length !== 3) {
      //audio
      result = parseHexString(c_str);
    }
    else {
      //video
      result.SPS = parseHexString(parsedString[1]);
      result.PPS = parseHexString(parsedString[2]);
    }
    return result;
  }

  function parseVideoQualityLevel(xml) {
    var result = {};
    parseAttributes({Bitrate: parseInt}, xml, result);
    parseAttributes({CodecPrivateData: parseCodecPrivateData}, xml, result);
    parseAttributes({MaxWidth: parseInt}, xml, result);
    parseAttributes({MaxHeight: parseInt}, xml, result);

    return result;
  }

  function parseAudioQualityLevel(xml) {
    var result = {};
    parseAttributes({Bitrate: parseInt}, xml, result);
    parseAttributes({CodecPrivateData: parseCodecPrivateData}, xml, result);
    parseAttributes({SamplingRate: parseInt}, xml, result);
    parseAttributes({Channels: parseInt}, xml, result);
    parseAttributes({BitsPerSample: parseInt}, xml, result);
    parseAttributes({PacketSize: parseInt}, xml, result);

    return result;
}

  function parseFragments(xml) {
    var result = [];
    if (xml == null) return result;
    var time = -1;
    for (var child = xml.firstElementChild; child != null;
        child = child.nextElementSibling) {
      if (child.nodeName == 'c') {
        var fragment = {};
        if (time == -1) {
          if (child.attributes.getNamedItem('t') != null) {
            time = parseInt(child.attributes['t'].value);
          }
          else {
            time = 0;
          }
        }
        fragment.time = time / 10000000;
        fragment.timeURL = time;

        if (child.attributes.getNamedItem('d') != null) {
          var duration = parseInt(child.attributes['d'].value);
          fragment.duration = duration / 10000000;
          fragment.durationURL = duration;
          time += duration;
          result.push(fragment);
        }
        else throw "Expected attribute 'd' not found";
      }
    }
    return result;
  }

  function parseStreamIndex(xml) {
    var result = {};
    parseAttributes({Type: str}, xml, result);
    parseAttributes({Url: str}, xml, result);
    if (result.Type === 'video') {
      result.QualityLevels = parseChildElements(
          'QualityLevel', parseVideoQualityLevel, xml);
    } else if (result.Type == 'audio') {
      result.QualityLevels = parseChildElements(
          'QualityLevel', parseAudioQualityLevel, xml);
    }
    result.Fragments = parseFragments(xml);
    return result;
  }

  // Maps SS streamIndexes to MPEG-DASH adaptationSets
  function createAdaptationSets(streamIndexes, contentProtection) {
    var adaptationSets = [];

    // We assume one audio and video stream or we use the last ones. If you have
    // multiple streams you may need to add some selection mechanism as
    // Chromecast may not be able to play the last ones.
    var validStreams = [];
    var audio = false;
    var video = false;
    for (var i = streamIndexes.length - 1; i >= 0; i--) {
      if (!video && (streamIndexes[i].Type === 'video')) {
        validStreams.push(i);
        video = true;
      }

      if (!audio && (streamIndexes[i].Type === 'audio')) {
        validStreams.push(i);
        audio = true;
      }

      if (video && audio) {
        break;
      }
    }
    for (var i = 0; i < streamIndexes.length; i++) {
      if (validStreams.indexOf(i) === -1) {
        continue;
      }
      var adaptationSet = {};
      adaptationSet.contentProtection = null;
      switch (streamIndexes[i].Type) {
        case 'audio':
          // Uncomment to ignore audio
          // continue;
          adaptationSet.mime = 'audio/mp4';
          break;
        case 'video':
          // Uncomment to ignore video
          // continue;
          adaptationSet.mime = 'video/mp4';
          break;
      }
      if (streamIndexes[i].QualityLevels) {
        adaptationSet.representations = [];
        for (var j = 0; j < streamIndexes[i].QualityLevels.length; j++) {
          var representation = {};
          representation.bandwidth = streamIndexes[i].QualityLevels[j].Bitrate;
          representation.baseURLs = [];
          representation.baseURLs[0] = streamIndexes[i].Url;
          representation.segmentBase = null;
          representation.segs = streamIndexes[i].Fragments;

          //Assumes specific codecs (mp4a.40.2 and avc1.4d40). This needs
          // to be generalized.
          switch (streamIndexes[i].Type) {
            case 'audio':
              representation.codecs = 'mp4a.40.2';
              representation.audio_codec_private_data =
                  streamIndexes[i].QualityLevels[j].CodecPrivateData;
              representation.audio_sample_rate =
                  streamIndexes[i].QualityLevels[j].SamplingRate;
              break;
            case 'video':
              representation.codecs = 'avc1.4d40' +
                  streamIndexes[i].QualityLevels[j].
                  CodecPrivateData.SPS[3].toString(16).toLowerCase();
              representation.sps = streamIndexes[i].QualityLevels[j].
                  CodecPrivateData.SPS;
              representation.pps = streamIndexes[i].QualityLevels[j].
                  CodecPrivateData.PPS;
              representation.width =
                  streamIndexes[i].QualityLevels[j].MaxWidth;
              representation.height =
                  streamIndexes[i].QualityLevels[j].MaxHeight;
              break;
          }


          adaptationSet.representations.push(representation);
        }
        adaptationSet.codecs = adaptationSet.representations[0].codecs;
      }

      if (contentProtection) {
        adaptationSet.contentProtection = contentProtection;
      }

      adaptationSets.push(adaptationSet);
    }
    return adaptationSets;
  }

  function base64toab(strb64) {
    var str = atob(strb64.trim());
    var ab = new ArrayBuffer(str.length);
    var u8 = new Uint8Array(ab);
    for (var i = 0; i < str.length; i++) {
      u8[i] = str.charCodeAt(i);
    }
    return ab;
  }

  function parseKID(ab) {
    var i = 0;
    var j = 0;
    var kid = [];
    var u16 = new Uint16Array(ab);
    var l = ab.byteLength / 2;
    while ((i < l) || (kid.length === 0)) {
      while ((i < l) && (u16[i] !== 0x003c)) i++;
      if ((u16[i + 1] === 0x004b) &&
          (u16[i + 2] === 0x0049) &&
          (u16[i + 3] === 0x0044) &&
          (u16[i + 4] === 0x003e)) {
        i = i + 5;
        while ((i < l) && (u16[i] !== 0x003c)) {
          kid.push(u16[i]);
          i++;
        }
      }
      else {
        i++;
      }
    }

    // kid is an array of a base64 encoded string
    var kid64 = String.fromCharCode.apply(null, kid);
    return base64toab(kid64);
  }

  function parseProtectionHeader(xml) {
    var result = {};
    parseAttributes({SystemID: parseGuid}, xml, result);
    var header = base64toab(xml.textContent);
    result.PrHeader = new Uint8Array(header);
    result.KID = new Uint8Array(parseKID(header));
    return result;
  }

  function parseProtection(xml) {
    var result = {};
    result.ProtectionHeader =
        parseChildElements('ProtectionHeader', parseProtectionHeader, xml)[0];
    return result;
  }

  function parseManifest(xml) {
    var result = {};
    parseAttributes({TimeScale: parseInt}, xml, result);
    if (!result.TimeScale) {
      result.TimeScale = 10000000;
    }
    parseAttributes({Duration: parseInt}, xml, result);
    result.StreamIndexes =
        parseChildElements('StreamIndex', parseStreamIndex, xml);
    var protection = parseChildElements('Protection', parseProtection, xml);
    if (protection && protection[0]) {
      result.Protection = protection[0];
    }

    result.duration = result.Duration / result.TimeScale;

    //adaptationsSets
    if (result.Protection) {
      // This should be read from the PR Header object
      var contentProtection = {};
      contentProtection.playready =
          'http://playready.directtaps.net/pr/svc/rightsmanager.asmx';
      result.adaptationSets =
          createAdaptationSets(result.StreamIndexes, contentProtection);
    }
    else {
      result.adaptationSets =
          createAdaptationSets(result.StreamIndexes);
    }

    // PR info
    if (result.Protection) {
      result.pr = {};
      result.pr.systemId = result.Protection.ProtectionHeader.SystemID;
      result.pr.prHeader = result.Protection.ProtectionHeader.PrHeader;
      // This should be read from PrHeader
      result.pr.ivsize = 8;
      result.pr.kid = result.Protection.ProtectionHeader.KID;
    }

    return result;
  }

  function normalizeRepresentations(mpd, url) {
    mpd.manifestURL = url;
    mpd.type = StreamingType.SMOOTH_STREAMING;
    return mpd;
  }

  function parseSSManifest(text, url) {
    var parser = new DOMParser();
    var dom = parser.parseFromString(text, 'text/xml');
    var ssnode;
    for (var i = 0; i < dom.childNodes.length; i++) {
      if (dom.childNodes[i].nodeName === 'SmoothStreamingMedia') {
        ssnode = dom.childNodes[i];
        break;
      }
    }
    return normalizeRepresentations(parseManifest(ssnode), url);
  }
  window.parseSSManifest = parseSSManifest;

})();
