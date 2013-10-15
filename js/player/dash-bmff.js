// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Dash bmff parsing to meet MSE requirements.
 */

(function() {

  'use strict';

  // Given an array buffer, return a slice of that buffer which contains the
  // initialization segment. Assumes initialization segment *starts* at
  // beginning.
  function extractInit(ab) {
    var d = new DataView(ab);
    var pos = 0;
    while (pos < ab.byteLength) {
      var type = d.getUint32(pos + 4, false);
      if (type == 0x73696478 || type == 0x6d6f6f66)
        break;
      pos += d.getUint32(pos, false);
    }
    return new Uint8Array(ab.slice(0, pos));
  }
  window.extractInit = extractInit;

  // Parse a 'sidx' atom from data in an array buffer. 'ab_first_byte_offset'
  // should be the offset of the first byte of the array buffer with respect to
  // whatever mechanism for retrieving byte offsets is in use.
  function parseSIDX(ab, ab_first_byte_offset) {
    var d = new DataView(ab);
    var pos = 0;
    while (d.getUint32(pos + 4, false) != 0x73696478) {
      pos += d.getUint32(pos, false);
      if (pos >= ab.byteLength) throw 'Could not find sidx';
    }

    var sidxEnd = d.getUint32(pos, false) + pos;
    if (sidxEnd > ab.byteLength) throw 'sidx terminates after array buffer';
    var version = d.getUint8(pos + 8);
    pos += 12;

    // Not used: reference_ID(32)
    var timescale = d.getUint32(pos + 4, false);
    pos += 8;

    var earliest_presentation_time, first_offset;
    if (version == 0) {
      earliest_presentation_time = d.getUint32(pos, false);
      first_offset = d.getUint32(pos + 4, false);
      pos += 8;
    } else {
      earliest_presentation_time =
          (d.getUint32(pos, false) << 32) + d.getUint32(pos + 4, false);
      first_offset =
          (d.getUint32(pos + 8, false) << 32) + d.getUint32(pos + 12, false);
      pos += 16;
    }
    first_offset += sidxEnd + (ab_first_byte_offset || 0);

    // Not used: reserved(16)
    var reference_count = d.getUint16(pos + 2, false);
    pos += 4;

    var offset = first_offset;
    var time = earliest_presentation_time;
    var references = [];
    for (var i = 0; i < reference_count; i++) {
      var ref_size = d.getUint32(pos, false);
      var ref_type = ref_size & 0x80000000;
      if (ref_type) throw 'Unhandled indirect reference';
      ref_size = ref_size & 0x7fffffff;
      var ref_dur = d.getUint32(pos + 4, false);
      pos += 12;
      references.push({'size': ref_size, 'offset': offset,
        'duration': ref_dur / timescale,
        'time': time / timescale});
      offset += ref_size;
      time += ref_dur;
    }
    if (pos != sidxEnd)
      throw 'Error: final pos ' + pos + ' differs from SIDX end ' + sidxEnd;
    return references;
  };
  window.parseSIDX = parseSIDX;

})();
