// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Very basic ttml (http://www.w3.org/TR/ttaf1-dfxp/) parser.
 */

(function() {
  'use strict';

  var Ttml = function(ttmlData) {
    this.ttml_ = ttmlData;
    // This should be taken from the file
    this.frameRate_ = 30;
  };

  Ttml.prototype.xmlDecode_ = function(s) {
    return s.replace(/&apos;/g, "'").
        replace(/&quot;/g, '"').
        replace(/&amp;/g, '&').
        replace(/&lt;/g, '<').
        replace(/&gt;/g, '>');
  };

  Ttml.prototype.parseChildElements_ = function(node_name, parse_func, xml) {
    var result = [];
    if (xml == null) return result;
    for (var child = xml.firstElementChild; child != null;
        child = child.nextElementSibling) {
      if (child.nodeName == node_name) {
        result.push(parse_func.call(this, child));
      }
    }
    return result;
  };

  Ttml.prototype.parseAttributes_ = function(attr_map, xml) {
    var result = {};
    for (var k in attr_map) {
      if (xml.attributes.getNamedItem(k) != null)
        result[k] = attr_map[k](xml.attributes[k].value);
    }
    return result;
  };

  // Parse hh:mm:ss:frames
  Ttml.prototype.parseTime_ = function(time) {
    var timeArray = time.split(':');
    var seconds = parseFloat(timeArray[0]) * 3600 +
        parseFloat(timeArray[1]) * 60 +
        parseFloat(timeArray[2]) +
        parseFloat(timeArray[3]) / this.frameRate_;

    return seconds;
  };

  Ttml.prototype.parseTextTrack_ = function(text) {
    var textTrack = this.xmlDecode_(
        text.replace(/[\r\n]+/g, '').
        replace(/ {2,}/g, ' ').
        replace(/<[^>]+>/g, '').
        replace(/<br\s*\/>/g, '\n'));

    return textTrack.trim();
  };

  Ttml.prototype.parse_cue_ = function(cue) {
    var cueData = this.parseAttributes_({begin: this.parseTime_.bind(this),
      end: this.parseTime_.bind(this)}, cue);
    if (cueData) {
      cueData.caption = this.parseTextTrack_(cue.textContent);
      cueData.start = cueData.begin;
      delete cueData.begin;
    }

    return cueData;
  };

  Ttml.prototype.parse_div_ = function(divNode) {
    return this.parseChildElements_('p', this.parse_cue_, divNode);
  };

  Ttml.prototype.parse_body_ = function(bodyNode) {
    var div = this.parseChildElements_('div', this.parse_div_, bodyNode);
    return div[0];
  };

  Ttml.prototype.parse_ttml_ = function(ttmlNode) {
    // We will ignore everything except the cues and the frame rate
    var body = this.parseChildElements_('body', this.parse_body_, ttmlNode);
    return body[0];
  };

  Ttml.prototype.parse = function() {
    var ttmlParser = new DOMParser();
    var dom = ttmlParser.parseFromString(this.ttml_, 'text/xml');
    for (var i = 0; i < dom.childNodes.length; i++) {
      if (dom.childNodes[i].nodeName === 'tt') {
        return this.parse_ttml_(dom.childNodes[i]);
      }
    }
  };

  window.Ttml = Ttml;

})();
