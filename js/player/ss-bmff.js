// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview SmoothStreaming bmff parsing to meet MSE requirements.
 */

(function() {
  'use strict';

  // Debug helper
  window.abtohex = function(ab) {
    var a = [];
    for (var i = 0; i < ab.byteLength; i++) {
      a.push(ab[i].toString(16));
    }
    return a;
  };

  window.abtob64 = function(ab) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(ab)));
  };

  //Add size
  function add_size(dv, pos, size) {
    dv.setUint32(pos, size);
  }

  //Add header, assumes boxName is 4 chars and
  //pos points to the beginning of the box
  function add_header(dv, pos, boxName) {
    for (var i = 0; i < 4; i++) {
      dv.setUint8(pos + 4 + i, boxName.charCodeAt(i));
    }
    return 8;
  }

  //Add blob array
  function add_array(mInfo, dv, a8, pos, blob) {
    a8.set(blob, pos);
    return pos + blob.length;
  }

  //Add a BMFF box
  function add_box(mInfo, dv, a8, pos, boxName, fbox) {
    var orig_pos = pos;
    pos += add_header(dv, pos, boxName);

    if (fbox) pos = fbox(mInfo, dv, a8, pos);

    //DEBUG  log(boxName + '[' + orig_pos + ']: ' + (pos - orig_pos));

    add_size(dv, orig_pos, pos - orig_pos);
    return pos;
  }

  //Add header and blob array
  function add_blob(mInfo, dv, a8, pos, boxName, blob) {
    return add_box(mInfo, dv, a8, pos, boxName,
        function(mInfo, dv, a8, pos) {
          return add_array(mInfo, dv, a8, pos, blob);
        }
    );
  }

  // MBFF Boxes

  //Add sidx
  function add_sidx(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'sidx',
        function(mInfo, dv, a8, pos) {
          pos = add_array(mInfo, dv, a8, pos,
              [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x98,
               0x96, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x25, 0x00, 0x03, 0x98, 0x45, 0x01, 0xC9,
               0xC3, 0x80, 0x90, 0x00, 0x00, 0x00, 0x00, 0x0B, 0x09, 0x3C,
               0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x0A,
               0xE2, 0x3E, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00,
               0x00, 0x06, 0xBD, 0x2C, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00,
               0x00, 0x00, 0x00, 0x08, 0x52, 0x51, 0x00, 0x06, 0xDF, 0x92,
               0x90, 0x00, 0x00, 0x00, 0x00, 0x0A, 0xBB, 0xF7, 0x00, 0x06,
               0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x0A, 0xFC, 0xD9,
               0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x09,
               0xE9, 0xF2, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00,
               0x00, 0x0A, 0xC9, 0xE6, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00,
               0x00, 0x00, 0x00, 0x05, 0xEF, 0x54, 0x00, 0x06, 0xDF, 0x92,
               0x90, 0x00, 0x00, 0x00, 0x00, 0x07, 0x55, 0x81, 0x00, 0x06,
               0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x07, 0xBA, 0x5F,
               0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x05,
               0xF3, 0x8A, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00,
               0x00, 0x09, 0xBF, 0xFF, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00,
               0x00, 0x00, 0x00, 0x07, 0x60, 0xAF, 0x00, 0x06, 0xDF, 0x92,
               0x90, 0x00, 0x00, 0x00, 0x00, 0x06, 0xD8, 0x2C, 0x00, 0x06,
               0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x06, 0xAE, 0xB6,
               0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x06,
               0x93, 0x8D, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00,
               0x00, 0x08, 0x38, 0x9C, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00,
               0x00, 0x00, 0x00, 0x0A, 0xCD, 0x5F, 0x00, 0x06, 0xDF, 0x92,
               0x90, 0x00, 0x00, 0x00, 0x00, 0x0A, 0xC2, 0x49, 0x00, 0x06,
               0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x09, 0x70, 0x89,
               0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x06,
               0x27, 0xEC, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00,
               0x00, 0x0A, 0x95, 0xFF, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00,
               0x00, 0x00, 0x00, 0x08, 0x7C, 0x59, 0x00, 0x06, 0xDF, 0x92,
               0x90, 0x00, 0x00, 0x00, 0x00, 0x09, 0xB2, 0xE8, 0x00, 0x06,
               0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x0A, 0x5D, 0xB3,
               0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x09,
               0x1C, 0x39, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00,
               0x00, 0x08, 0x3A, 0xB4, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00,
               0x00, 0x00, 0x00, 0x09, 0xF5, 0x76, 0x00, 0x06, 0xDF, 0x92,
               0x90, 0x00, 0x00, 0x00, 0x00, 0x08, 0xBE, 0x9C, 0x00, 0x06,
               0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x09, 0x17, 0xAC,
               0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x03,
               0x61, 0xB3, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00, 0x00, 0x00,
               0x00, 0x08, 0x19, 0x34, 0x00, 0x06, 0xDF, 0x92, 0x90, 0x00,
               0x00, 0x00, 0x00, 0x02, 0xF5, 0x6E, 0x00, 0x06, 0xDF, 0x92,
               0x90, 0x00, 0x00, 0x00, 0x00, 0x01, 0xD2, 0xD6, 0x00, 0x06,
               0xDF, 0x92, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x5A, 0x5E,
               0x00, 0x01, 0xB7, 0xD5, 0x90, 0x00, 0x00, 0x00]);
          return pos;
        }
    );
  }

  //Add smhd
  function add_smhd(mInfo, dv, a8, pos) {
    return add_blob(mInfo, dv, a8, pos, 'smhd',
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }

  //Add vmhd
  function add_vmhd(mInfo, dv, a8, pos) {
    return add_blob(mInfo, dv, a8, pos, 'vmhd',
        [0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
         0x00, 0x00]);
  }

  //Add esds
  function add_esds(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'esds',
        function(mInfo, dv, a8, pos) {
          // audio codec private data
          var apd0 = mInfo.audio_codec_private_data[0];
          var apd1 = mInfo.audio_codec_private_data[1];
          pos = add_array(mInfo, dv, a8, pos,
              [0x00, 0x00, 0x00, 0x00, 0x03, 0x19, 0x00, 0x01, 0x00, 0x04,
               0x11, 0x40, 0x15, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00, 0x05, 0x02, apd0, apd1, 0x06, 0x01,
               0x02]);
          return pos;
        }
    );
  }

  //Add avcC
  function add_avcC(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'avcC',
        function(mInfo, dv, a8, pos) {
          pos = add_array(mInfo, dv, a8, pos,
              [0x01, 0x4D, 0x40, 0x1E, 0xFF, 0xE1]);
          dv.setUint16(pos, mInfo.sps.length);
          pos += 2;
          pos = add_array(mInfo, dv, a8, pos, mInfo.sps);
          dv.setUint8(pos, 0x01);
          pos += 1;
          dv.setUint16(pos, mInfo.pps.length);
          pos += 2;
          pos = add_array(mInfo, dv, a8, pos, mInfo.pps);
          return pos;
        }
    );
  }

  // Rotates bytes between [start-end] (both inclusive)
  function rotate(a8, start, end) {
    var len = end - start + 1;
    var tmp = 0;
    for (var i = start; i < start + (len / 2); i++) {
      tmp = a8[i];
      a8[i] = a8[end - i + start];
      a8[end - i + start] = tmp;
    }
  }

  // NOTE: We need to provide the proper endianess.
  // Eureka reverts them to support cenc so for microsoft playready
  // we need to pre-reorder
  // http://en.wikipedia.org/wiki/Globally_unique_identifier
  function getNewKID(a8) {
    var ab = new ArrayBuffer(a8.length);
    var a82 = new Uint8Array(ab);
    a82.set(a8);
    rotate(a82, 0, 3);
    rotate(a82, 4, 5);
    rotate(a82, 6, 7);
    return a82;
  }

  //Add tenc
  function add_tenc(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'tenc',
        function(mInfo, dv, a8, pos) {
          // version + flags + 0x000001 (Is encrypted = 1)
          pos = add_array(mInfo, dv, a8, pos, [0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x01]);
          // default Iv Size
          dv.setUint8(pos, mInfo.pr.ivsize);
          pos++;
          // default KID
          // NOTE: We need to provide the proper endianess as YouTube
          // changes it to support cenc and Eureka is the one reverting them
          // so for microsoft playready we need to pre-reorder
          // http://en.wikipedia.org/wiki/Globally_unique_identifier
          var newKid = getNewKID(mInfo.pr.kid);

          pos = add_array(mInfo, dv, a8, pos, newKid);
          return pos;
        }
    );

  }

  //Add schi
  function add_schi(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'schi',
        function(mInfo, dv, a8, pos) {
          pos = add_tenc(mInfo, dv, a8, pos);
          return pos;
        }
    );
  }

  //Add schm
  function add_schm(mInfo, dv, a8, pos) {
    return add_blob(mInfo, dv, a8, pos, 'schm',
        [0x00, 0x00, 0x00, 0x00, 0x63, 0x65, 0x6E, 0x63, 0x00, 0x01,
         0x00, 0x00]);
  }

  //Add frma
  // We are assuming avc1 or mp4a
  function add_frma(mInfo, dv, a8, pos) {
    if (mInfo.mime !== 'audio/mp4') {
      return add_blob(mInfo, dv, a8, pos, 'frma',
          [0x61, 0x76, 0x63, 0x031]);
    }
    else {
      return add_blob(mInfo, dv, a8, pos, 'frma',
          [0x6d, 0x70, 0x34, 0x061]);
    }
  }

  //Add sinf
  function add_sinf(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'sinf',
        function(mInfo, dv, a8, pos) {
          pos = add_frma(mInfo, dv, a8, pos);
          pos = add_schm(mInfo, dv, a8, pos);
          pos = add_schi(mInfo, dv, a8, pos);
          return pos;
        }
    );
  }

  //Add mp4a or enca
  function add_a(mInfo, dv, a8, pos, boxName) {
    return add_box(mInfo, dv, a8, pos, boxName,
        function(mInfo, dv, a8, pos) {
          // audio sample rate
          var asr0 = (mInfo.audio_sample_rate >> 8) & 0xff;
          var asr1 = mInfo.audio_sample_rate & 0xff;
          pos = add_array(mInfo, dv, a8, pos,
              [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x10,
               0x00, 0x00, 0x00, 0x00, asr0, asr1, 0x00, 0x00]);
          pos = add_esds(mInfo, dv, a8, pos);
          if (boxName === 'enca') {
            pos = add_sinf(mInfo, dv, a8, pos);
          }
          return pos;
        }
    );
  }

  //Add avc1 or encv
  function add_v(mInfo, dv, a8, pos, boxName) {
    return add_box(mInfo, dv, a8, pos, boxName,
        function(mInfo, dv, a8, pos) {
          pos = add_array(mInfo, dv, a8, pos,
              [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00]);
          dv.setUint16(pos, mInfo.width);
          pos += 2;
          dv.setUint16(pos, mInfo.height);
          pos += 2;
          pos = add_array(mInfo, dv, a8, pos,
              [0x00, 0x48,
               0x00, 0x00, 0x00, 0x48, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0xFF, 0xFF]);
          pos = add_avcC(mInfo, dv, a8, pos);
          if (boxName === 'encv') {
            pos = add_sinf(mInfo, dv, a8, pos);
          }
          return pos;
        }
    );
  }

  //Add stsd
  function add_stsd(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'stsd',
        function(mInfo, dv, a8, pos) {
          pos = add_array(mInfo, dv, a8, pos,
              [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);

          if (mInfo.mime !== 'audio/mp4') {
            if (mInfo.pr) {
              pos = add_v(mInfo, dv, a8, pos, 'encv');
            }
            pos = add_v(mInfo, dv, a8, pos, 'avc1');
          }
          else {
            if (mInfo.pr) {
              pos = add_a(mInfo, dv, a8, pos, 'enca');
            }
            pos = add_a(mInfo, dv, a8, pos, 'mp4a');
          }
          return pos;
        }
    );
  }

  //Add stbl
  function add_stbl(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'stbl',
        function(mInfo, dv, a8, pos) {
          pos = add_stsd(mInfo, dv, a8, pos);
          if (mInfo.mime !== 'audio/mp4') {
            pos = add_array(mInfo, dv, a8, pos,
                [0x00, 0x00, 0x00, 0x10, 0x73, 0x74, 0x74, 0x73, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10,
                 0x73, 0x74, 0x73, 0x63, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x73, 0x74, 0x63, 0x6F,
                 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x14, 0x73, 0x74, 0x73, 0x7A, 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x10, 0x73, 0x74, 0x73, 0x73, 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00]);
          }
          else {
            pos = add_array(mInfo, dv, a8, pos,
                [0x00, 0x00, 0x00, 0x10, 0x73, 0x74, 0x74, 0x73, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10,
                 0x73, 0x74, 0x73, 0x63, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x73, 0x74, 0x63, 0x6F,
                 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x14, 0x73, 0x74, 0x73, 0x7A, 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
          }
          return pos;
        }
    );
  }

  //Add url
  function add_url(mInfo, dv, a8, pos) {
    return add_blob(mInfo, dv, a8, pos, 'url ',
        [0x00, 0x00, 0x00, 0x01]);
  }

  //Add dref
  function add_dref(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'dref',
        function(mInfo, dv, a8, pos) {
          pos = add_array(mInfo, dv, a8, pos,
              [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
          pos = add_url(mInfo, dv, a8, pos);
          return pos;
        }
    );
  }

  //Add dinf
  function add_dinf(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'dinf',
        function(mInfo, dv, a8, pos) {
          pos = add_dref(mInfo, dv, a8, pos);
          return pos;
        }
    );
  }

  //Add minf
  function add_minf(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'minf',
        function(mInfo, dv, a8, pos) {
          pos = add_dinf(mInfo, dv, a8, pos);
          pos = add_stbl(mInfo, dv, a8, pos);
          if (mInfo.mime !== 'audio/mp4') {
            pos = add_vmhd(mInfo, dv, a8, pos);
          }
          else {
            pos = add_smhd(mInfo, dv, a8, pos);
          }
          return pos;
        }
    );
  }

  //Add hdlr
  function add_hdlr(mInfo, dv, a8, pos) {
    if (mInfo.mime !== 'audio/mp4') {
      return add_blob(mInfo, dv, a8, pos, 'hdlr',
          [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x76, 0x69,
           0x64, 0x65, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
           0x00, 0x00, 0x00, 0x00, 0x56, 0x69, 0x64, 0x65, 0x6F, 0x48,
           0x61, 0x6E, 0x64, 0x6C, 0x65, 0x72, 0x00]);
    }
    else {
      return add_blob(mInfo, dv, a8, pos, 'hdlr',
          [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x73, 0x6F,
           0x75, 0x6E, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
           0x00, 0x00, 0x00, 0x00, 0x53, 0x6F, 0x75, 0x6E, 0x64, 0x48,
           0x61, 0x6E, 0x64, 0x6C, 0x65, 0x72, 0x00]);
    }
  }

  //Add mdhd
  function add_mdhd(mInfo, dv, a8, pos) {
    return add_blob(mInfo, dv, a8, pos, 'mdhd',
        [0x00, 0x00, 0x00, 0x00, 0xCC, 0x60, 0x76, 0xF1, 0xCC, 0x60,
         0x76, 0xF1, 0x00, 0x98, 0x96, 0x80, 0x00, 0x00, 0x00, 0x00,
         0x55, 0xC4, 0x00, 0x00]);
  }

  //Add mdia
  function add_mdia(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'mdia',
        function(mInfo, dv, a8, pos) {
          pos = add_mdhd(mInfo, dv, a8, pos);
          pos = add_hdlr(mInfo, dv, a8, pos);
          pos = add_minf(mInfo, dv, a8, pos);
          return pos;
        }
    );
  }

  //Add elst
  function add_elst(mInfo, dv, a8, pos) {
    return add_blob(mInfo, dv, a8, pos, 'elst',
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
         0x00, 0x00, 0x00, 0x00, 0x0E, 0xAA, 0x00, 0x00, 0x00, 0x01]);
  }

  //Add edts
  function add_edts(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'edts',
        function(mInfo, dv, a8, pos) {
          pos = add_elst(mInfo, dv, a8, pos);
          return pos;
        }
    );
  }

  //Add tkhd
  function add_tkhd(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'tkhd',
        function(mInfo, dv, a8, pos) {
          pos = add_array(mInfo, dv, a8, pos,
              [0x00, 0x00, 0x00, 0x03, 0xCC, 0x60, 0x76, 0xF1, 0xCC, 0x60,
               0x76, 0xF1, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x40, 0x00, 0x00, 0x00]);
          dv.setUint32(pos, mInfo.width);
          pos += 4;
          dv.setUint32(pos, mInfo.height);
          pos += 4;
          dv.setUint16(pos, 0);
          pos += 2;
          return pos;
        }
    );
  }

  //Add trak
  function add_trak(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'trak',
        function(mInfo, dv, a8, pos) {
          pos = add_tkhd(mInfo, dv, a8, pos);
          if (mInfo.mime !== 'audio/mp4') {
            pos = add_edts(mInfo, dv, a8, pos);
          }
          pos = add_mdia(mInfo, dv, a8, pos);
          return pos;
        }
    );
  }

  //Add trex
  function add_trex(mInfo, dv, a8, pos) {
    return add_blob(mInfo, dv, a8, pos, 'trex',
        [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
         0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
         0x00, 0x00, 0x00, 0x00]);
  }

  //Add mvex
  function add_mvex(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'mvex',
        function(mInfo, dv, a8, pos) {
          pos = add_trex(mInfo, dv, a8, pos);
          return pos;
        }
    );
  }

  //Add pssh
  function add_pssh(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'pssh',
        function(mInfo, dv, a8, pos) {
          // version + flags
          pos = add_array(mInfo, dv, a8, pos, [0x00, 0x00, 0x00, 0x00]);
          // systemId
          pos = add_array(mInfo, dv, a8, pos, mInfo.pr.systemId);
          // data size and data (playready header)
          dv.setUint32(pos, mInfo.pr.prHeader.length);
          pos += 4;
          pos = add_array(mInfo, dv, a8, pos, mInfo.pr.prHeader);
          return pos;
        }
    );
  }

  //Add mvhd
  function add_mvhd(mInfo, dv, a8, pos) {
    return add_blob(mInfo, dv, a8, pos, 'mvhd',
        [0x00, 0x00, 0x00, 0x00, 0xCC, 0x60, 0x76, 0xF1, 0xCC, 0x60,
         0x76, 0xF1, 0x00, 0x98, 0x96, 0x80, 0x00, 0x00, 0x00, 0x00,
         0x00, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
         0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
         0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
         0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
         0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00,
         0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
         0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
         0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02]);
  }

  //Add moov
  function add_moov(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'moov',
        function(mInfo, dv, a8, pos) {
          pos = add_mvhd(mInfo, dv, a8, pos);
          if (mInfo.pr) {
            pos = add_pssh(mInfo, dv, a8, pos);
          }
          pos = add_mvex(mInfo, dv, a8, pos);
          pos = add_trak(mInfo, dv, a8, pos);
          return pos;
        }
    );
  }

  //Add ftyp
  function add_ftyp(mInfo, dv, a8, pos) {
    return add_blob(mInfo, dv, a8, pos, 'ftyp',
        [0x64, 0x61, 0x73, 0x68, 0x00, 0x00, 0x00, 0x00, 0x69, 0x73,
         0x6F, 0x36, 0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31]);
  }

  //Debug
  function verifyEqual(a81, a82) {
    var i = 0;
    if (a81.length !== a82.length) {
      log('sizes are different: ' + a81.length + ' ' + a82.length);
      return;
    }

    for (i = 0; i < a82.length; i++) {
      if (a81[i] !== a82[i]) {
        log('different values: Position ' + i + ' ' + a81[i] + ' ' + a82[i]);
      }
    }

  }

  // Create an init segment required by the Media Source Extensions.
  // Smooth Streaming puts the required information in its manifest
  // we wil use that information to build the init segment
  function createSSInit(mInfo) {
    var ab = new ArrayBuffer(20000);
    var dv = new DataView(ab);
    var a8 = new Uint8Array(ab);
    var pos = 0;
    var initEnd = 0;

    //pos = add_ftyp(mInfo, dv, a8, pos);
    pos = add_moov(mInfo, dv, a8, pos);
    initEnd = pos - 1;
    //pos = add_sidx(mInfo, dv, a8, pos);

    var initObj = {};
    initObj.data = ab.slice(0, pos);
    initObj.init = {};
    initObj.init.start = 0;
    initObj.init.end = initEnd;

    return initObj;
  }
  window.createSSInit = createSSInit;

  //start must be the start of a sibling box of the one we look for (one
  //that comes before in the stream)
  function findBox(dv, start, boxName) {
    var nameInt = 0;
    var pos = start;
    for (var i = 0; i < 4; i++) {
      nameInt <<= 8;
      nameInt += boxName.charCodeAt(i);
    }
    while (dv.getUint32(pos + 4, false) != nameInt) {
      pos += dv.getUint32(pos);
      if (pos >= dv.byteLength) throw ('Could not find box: ' + boxName);
    }

    return pos;
  }

  /* 
   * Force the trackId to be 1. Smoothstreaming does not seem to use the trackid
   * so some encoders use trackId 2. For us is important that the trackId in the
   * moov matches the one in the moof.
   * We set both to 1 as when we create the moov we do not now what the
   * moof will use (the SS manifest does not have that info).
   * Here we need to be sure to fix the trackId to 1 so they match.  
   */
  function fixTrackId(dv, start) {
    var pos = findBox(dv, start, 'traf');
    var pos = findBox(dv, pos + 8, 'tfhd');
    dv.setUint32(pos + 12, 1);
  }
  
  //start must be the start of a sibling box of the one we look for (one
  //taht comes before in the stream)
  function increase_size(dv, start, boxName, size) {
    var pos = findBox(dv, start, boxName);
    var cs = dv.getUint32(pos);
    dv.setUint32(pos, cs + size);
    return pos;
  }

  function setSizes(dv, size, trunSize) {
    var pos = 0;
    //Change sizes
    pos = increase_size(dv, pos, 'moof', size);
    pos = increase_size(dv, pos + 8, 'traf', size);

    //Change trun data offset
    pos = findBox(dv, pos + 8, 'trun');
    var trunDataOffsetPos = pos + 16; // DataOffset is at rel position 16
    dv.setUint32(trunDataOffsetPos, trunSize);

    return pos;
  }

  function increaseSizes(dv, size, trunSize) {
    var pos = 0;
    //Change sizes
    pos = increase_size(dv, pos, 'moof', size);
    pos = increase_size(dv, pos + 8, 'traf', size);

    //Change trun data offset
    pos = findBox(dv, pos + 8, 'trun');
    var trunDataOffsetPos = pos + 16; // DataOffset is at rel position 16
    var cs = dv.getUint32(trunDataOffsetPos);
    dv.setUint32(trunDataOffsetPos, cs + trunSize);

    return pos;
  }

  // Inserts tfdt into the moof
  function insert_tfdt(moof, bmdt) {
    // We use version = 1 so the length is 64 bits
    var tfdt = [0x00, 0x00, 0x00, 0x14, 0x74, 0x66, 0x64, 0x74, 0x01, 0x00,
      0x00, 0x00];
    var tfdtSize = tfdt.length + 8;
    var ab = new ArrayBuffer(moof.byteLength + tfdtSize);
    var a8 = new Uint8Array(moof);
    var dv = new DataView(moof);
    var a82 = new Uint8Array(ab);
    var dv2 = new DataView(ab);
    var pos = 0;

    // Ensure that trackIds are fine
    fixTrackId(dv, 8);
    
    //Change sizes
    pos = increaseSizes(dv, tfdtSize, tfdtSize);

    // Insert tfdt between tfhd and trun
    a82.set(new Uint8Array(moof, 0, pos));
    a82.set(tfdt, pos);
    // Bit shift operator in js is up to 32 bits so use division
    dv2.setUint32(pos + 12, (bmdt / 0xFFFFFFFF) & 0xFFFFFFFF);
    dv2.setUint32(pos + 16, bmdt & 0xFFFFFFFF);
    a82.set(
        new Uint8Array(moof, pos, moof.byteLength - pos),
        pos + tfdtSize);

    return ab;
  }

  function get_sampleSizes(dv, pos, nSamples, ivSize, subSampleEnc) {

    if (!subSampleEnc) return new Uint8Array(0);
    // Each sample is 6 bytes x number of entries
    var sizes = new Uint8Array(nSamples);
    var nEntries = 0;
    var entrySize = 0;
    var entryPos = pos;
    for (var i = 0; i < nSamples; i++) {
      nEntries = dv.getUint16(entryPos + ivSize);
      entrySize = ivSize + 2 + (6 * nEntries);
      sizes[i] = entrySize;
      entryPos += entrySize;
    }

    return sizes;
  }

  //Add mdat_enc
  function add_mdat_enc(mInfo, dv, a8, pos, a8samples, a8mdat) {
    return add_box(mInfo, dv, a8, pos, 'mdat',
        function(mInfo, dv, a8, pos) {
          pos = add_array(mInfo, dv, a8, pos, a8samples);
          pos = add_array(mInfo, dv, a8, pos, a8mdat);
          return pos;
        }
    );
  }

  //Add saio
  function add_saio(mInfo, dv, a8, pos) {
    return add_box(mInfo, dv, a8, pos, 'saio',
        function(mInfo, dv, a8, pos) {
          pos = add_array(mInfo, dv, a8, pos,
              [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
          // Assuming mdat is inmediately after saio
          // the offset is mdat_first_pos + 8 where mdat_first_pos
          // is the current pos + 4
          var offset = pos + 4 + 8;
          dv.setUint32(pos, offset);
          pos += 4;

          return pos;
        }
    );
  }

  //Add saiz
  function add_saiz(
      mInfo, dv, a8, pos, samples, sampleSizes, subSampleEnc, ivSize) {
    return add_box(mInfo, dv, a8, pos, 'saiz',
        function(mInfo, dv, a8, pos) {
          if (subSampleEnc) {
            pos = add_array(mInfo, dv, a8, pos, [0x00, 0x00, 0x00, 0x00, 0x00]);
          }
          else {
            // Set default sample size to iv_size
            pos =
                add_array(mInfo, dv, a8, pos, [0x00, 0x00, 0x00, 0x00, ivSize]);
          }
          dv.setUint32(pos, samples);
          pos += 4;
          a8.set(sampleSizes, pos);
          // It may happen that samples !== 0 and sampleSizes.length === 0
          // when there is no subsample encription data (only the iv) the size
          // of saiz is optimized
          pos += sampleSizes.length;

          return pos;
        }
    );
  }

  function createNewMoof(ab) {
    //Copy tfhd, tfdt, trun and sdtp (everything before uuid) to new buffer

    var dv = new DataView(ab);
    var pos = 0;
    var nSamples = 0;
    var samplesTotalSize = 0;
    var moofOrigSize = dv.getUint32(pos);

    // Find 'uuid' under moof/traf
    pos = findBox(dv, pos + 8, 'traf');
    pos = findBox(dv, pos + 8, 'trun');
    nSamples = dv.getUint32(pos + 12); // nsamples at trun + 12
    pos = findBox(dv, pos, 'uuid');

    //Verify playready extended type value
    var pr_extended_type = [0xA2, 0x39, 0x4F, 0x52, 0x5A, 0x9B, 0x4F, 0x14,
      0xA2, 0x44, 0x6C, 0x42, 0x7C, 0x64, 0x8D, 0xF4];

    // We are assuming that flags is 2 so the uuid does not
    // contain the AlgorithmID, IV_size and KID
    var flags = dv.getUint8(pos + 27);
    var subSampleEnc = false;
    if ((flags !== 0x02) && (flags !== 0x00)) throw (
        'uuid flags expected is 0x02 or 0x00 but found: ' + flags);
    if (flags === 0x02) {
      subSampleEnc = true;
    }

    // Verify that number of samples matches
    var uuidSamplesCount = dv.getUint32(pos + 28);
    if (nSamples !== uuidSamplesCount) {
      throw (
          'Samples count does not match ' + nSamples + ' ' + uuidSamplesCount);
    }
    // samplesTotalSize = uuid size - 32
    var uuidSize = dv.getUint32(pos);
    samplesTotalSize = uuidSize - 32;

    // New buffer
    // Extra size needed assumed not to exceed 200.
    var extraSize = 200;
    var ab2 = new ArrayBuffer(ab.byteLength + extraSize);
    var a82 = new Uint8Array(ab2);
    var dv2 = new DataView(ab2);

    a82.set(new Uint8Array(ab, 0, pos));
    var pos2 = pos;

    // Create saiz and saio
    // Assumed ivSize is 8
    var ivSize = 8;
    var samplesFirstPos = pos + 32;
    var mdatFirstPos = pos + uuidSize;
    var mdatSize = dv.getUint32(mdatFirstPos);
    var sampleSizes = get_sampleSizes(
        dv, samplesFirstPos, nSamples, ivSize, subSampleEnc);
    pos2 = add_saiz(
        null, dv2, a82, pos2, nSamples, sampleSizes, subSampleEnc, ivSize);
    pos2 = add_saio(null, dv2, a82, pos2);

    //Verification that SUM(sampleSizes) === samplesTotalSize
    if (subSampleEnc) {
      var ts = 0;
      for (var j = 0; j < sampleSizes.length; j++) {
        ts += sampleSizes[j];
      }

      if (ts !== samplesTotalSize) {
        throw ('Samples size does not match ' + ts + ' ' + samplesTotalSize);
      }
    }
    else {
      if ((ivSize * nSamples) !== samplesTotalSize) {
        throw ('Samples size does not match ' +
            (ivSize * nSamples) + ' ' + samplesTotalSize);
      }
    }

    //Create new mdat
    var a8samples = new Uint8Array(ab, samplesFirstPos, samplesTotalSize);
    var a8mdat = new Uint8Array(ab, mdatFirstPos + 8, mdatSize - 8);
    // moofIncreasedSize is negative as moof is reduced because
    // uuid samples are moved inside mdata
    var moofIncreasedSize = pos2 - moofOrigSize;
    var mdatPos = pos2;

    pos2 = add_mdat_enc(null, dv2, a82, pos2, a8samples, a8mdat);

    //Change moof and traf sizes and trun data offset
    setSizes(dv2, moofIncreasedSize, mdatPos + 8 + samplesTotalSize);
    return new Uint8Array(ab2, 0, pos2);

  }

  // Adds tfdt to the moof using the base media decode time passed in
  // also modifies playready boxes to comply with Media Source Extension
  // and cenc.
  // @moof is the moof received from the server
  // @bmdt is the base media decode time
  // What we need to do:
  // 1) Insert tfdt
  // 2) Copy tfhd, tfdt, trun and sdtp (everything before uuid) to new buffer
  // 3) Create saiz and saio
  // 4) Copy uuid data to mdat
  // 5) Copy mdat data to mdat
  function process_traf(moof, bmdt, enc) {
    var ab = insert_tfdt(moof, bmdt);
    if (enc) {
      return createNewMoof(ab);
    }

    return new Uint8Array(ab);
  }

  window.process_traf = process_traf;

})();
