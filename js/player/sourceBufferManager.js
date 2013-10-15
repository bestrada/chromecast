// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Wrapper for SourceBuffer to manage initialization and caching.
 */

(function() {

  'use strict';

  var BUFFERING = {
    ENOUGH: 20,
    SAFE: 5,
    LOW: 2,
    AUTO_PAUSE_START: 1,
    PAUSE_RESUME: 5,
    SEEK_RESUME: 5
  };

  var sourceBufferState = {
    NORMAL: 'normal',
    SEEKING: 'seeking' };

  var seekingState = {
    NONE: 'none',
    STARTED: 'started',
    ENOUGH_DATA: 'enough_data' };


  var SourceBufferManager = function(msrc, sourceBuffer, reps, mime, type, pr) {
    this.sourceBuffer_ = sourceBuffer;
    this.representations_ = reps;
    this.currentRep = 0;
    this.segIndex = null;
    this.mime = mime;
    this.resetReason = null;
    this.cacheData = null;
    this.state = sourceBufferState.NORMAL;
    this.active = true;
    this.type = type;
    this.pr_ = pr;
    this.seekingState_ = seekingState.NONE;
    this.seekingStartTime = null;
    this.mediaSrc_ = msrc;
    this.bitrates = [];
    for (var i = 0; i < this.representations_.length; i++) {
      this.bitrates.push(this.representations_[i].bandwidth);
    }


  };

  SourceBufferManager.prototype.reset = function(reason) {
    dlog(1, 'SourceBuffer[' + this.mime + '] reset: ' + reason);

    this.segIndex = null;

    this.representations_[this.currentRep].isInitialized = false;
    this.resetReason = reason || null;

    this.cacheData = null;
    this.state = sourceBufferState.NORMAL;

    if (this.mediaSrc_.readyState != 'open') {
      return;
    }

    this.sourceBuffer_.abort();
  };

  SourceBufferManager.prototype.isInitialized = function() {
    return this.representations_[this.currentRep].isInitialized;
  };

  SourceBufferManager.prototype.initialize = function() {
    this.representations_[this.currentRep].isInitialized = true;
  };

  SourceBufferManager.prototype.append = function(data) {
    this.sourceBuffer_.append(data);
  };

  SourceBufferManager.prototype.getCurrentRep = function() {
    return this.representations_[this.currentRep];
  };

  SourceBufferManager.prototype.changeQuality = function(level) {
    if (level === this.currentRep) {
      return false;
    }

    dlog(
        2, 'Bandwitdth change sourceBuffer[' + this.mime + ']: ' + this.active);
    dlog(
        2,
        'bandwidthChange[' + this.mime + ']: ' + this.currentRep + ' ' + level);

    var reason;
    var oldLevel = this.representations_[this.currentRep].bandwidth;
    var newLevel = this.representations_[level].bandwidth;
    dlog(2, 'bandwidthChange[' + this.mime + ']: ' + oldLevel + ' ' + newLevel);

    if (oldLevel > newLevel) {
      reason = 'rep_down';
    } else {
      reason = 'rep_up';
    }

    this.reset(reason);
    this.currentRep = level;
  };

  SourceBufferManager.prototype.getRangesString = function() {
    var ranges = this.sourceBuffer_.buffered;
    var rangesInfo = 'Ranges[' + this.mime + ']:';

    for (var j = 0; j < ranges.length; j++) {
      rangesInfo += ' [' + ranges.start(j) + ',' + ranges.end(j) + ']';
    }

    return rangesInfo;
  };

  SourceBufferManager.prototype.findRangeForPlaybackTime = function(time) {
    var ranges = this.sourceBuffer_.buffered;
    for (var i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= time && ranges.end(i) >= time) {
        return {
          'start': ranges.start(i),
          'end': ranges.end(i) };
      }
    }

    return null;
  };

  SourceBufferManager.prototype.getBufferSize = function(currentTime) {

    // Find the end of the current buffered range, if any, and compare that
    // against the current time to determine if we're stalling
    dlog(4, 'Time: ' + currentTime + ' Ranges in onProgress: ' +
        this.getRangesString());
    var range = this.findRangeForPlaybackTime(currentTime);
    var endLastBuffer = range && range.end || 0;

    if (this.segIndex !== null) {
      var lastSegTime =
          this.representations_[this.currentRep].segs[this.segIndex].time;
      endLastBuffer =
          (lastSegTime > endLastBuffer) ? lastSegTime : endLastBuffer;
    }

    if (range) {
      var diff = Math.abs(range.end - endLastBuffer);
      if (diff > 0.001) {
        dlog(2, 'Difference in available data: ' + range.end + ' ' +
            endLastBuffer);
      }
    }

    return endLastBuffer - currentTime;
  };

  SourceBufferManager.prototype.findSegmentIndexForTime = function(time) {
    var segments = this.representations_[this.currentRep].segs;
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      if (s.time <= time && s.time + s.duration >= time) {
        // Don't be too eager to return a segment from the end of the buffered
        // ranges. (This hack will go away in the more principled
        // implementations.)
        if (i == segments.length - 1 && s.time + s.duration + 0.5 < time)
          return null;

        return i;
      }
    }
    dlog(5, 'Could not find segment for time ' + time);
  };

  SourceBufferManager.prototype.identifyNextFragment = function(currentTime) {

    var range = this.findRangeForPlaybackTime(currentTime);
    var nextTime = (range && range.end) || currentTime;

    if (nextTime > currentTime + BUFFERING.ENOUGH) {
      dlog(3, 'Enough buffering currentTime in rage: ' + this.mime + ' ' +
          currentTime + ' ' + ' ' + nextTime);
      return null;
    }

    if (this.segIndex == null) {
      dlog(4,
          'Non existing index, finding the index for the next request[' +
          this.mime + ']');
      this.segIndex = this.findSegmentIndexForTime(nextTime);

      dlog(
          4, 'New Index[' + this.mime + ']: ' + nextTime + ' ' + this.segIndex);
    }
    else {
      if (range == null) {
        // If buf.segIdx is set, we're continuing to append data consecutively
        // from some previous point, as opposed to choosing a new location to
        // start appending from. The only reason a the playback head *should* be
        // outside of a buffered region is that we've seeked, which should have
        // triggered an append location change if the current head fell outside
        // of a buffered region (or in the future, if the current buffered
        // region has content from a different quality level - but we don't
        // track that yet or flush the buffer on quality change). It's normal
        // to see this message once or maybe even twice after a seek, since
        // seeking near the end of a high-bitrate segment may mean the first
        // append didn't cover the full time between segment start and current
        // time, but seeing this any more than that is a pretty big error.
        // Seeing this outside of a seek means something's lying, or we
        // underflowed and playback didn't stall.
        log('Playback head outside of buffer in append-continue state.');
      }

      // It may happen that we have
      // buffered enough but range is null because the MSE buffers do not
      // contain the current time. buf.segIdx !== null in this case as we are
      // just appending. So we should verify that the time requested is not too
      // high
      var endLastBuffer =
          this.representations_[this.currentRep].segs[this.segIndex].time;

      if (endLastBuffer > currentTime + BUFFERING.ENOUGH) {
        dlog(3, 'Enough buffering: ' + this.mime + ' ' + this.segIndex + ' ' +
            currentTime + ' ' + ' ' + endLastBuffer);
        return null;
      }
    }

    return nextTime;
  };

  SourceBufferManager.prototype.appendData = function(data) {

    dlog(4, 'Ranges in appendData1: ' + this.getRangesString());

    var a8;
    var bufferStartTime =
        this.representations_[this.currentRep].segs[this.segIndex].time;
    var bufferEndTime = bufferStartTime +
        this.representations_[this.currentRep].segs[this.segIndex].duration;
    dlog(4, 'Appending Response [' + this.mime + '] : ' +
        '[' + bufferStartTime + ',' + bufferEndTime + ']');

    if (this.type === StreamingType.SMOOTH_STREAMING) {
      // We need to add/modify the incoming data in the traf box
      a8 = process_traf(
          data,
          this.representations_[this.currentRep].segs[this.segIndex].timeURL,
          this.pr_);
    }
    else {
      a8 = new Uint8Array(data);
    }

    if (this.seekingState_ === seekingState.NONE) {
      // We are not seeking so append data normally
      this.cacheData = null;
      this.sourceBuffer_.append(a8);
    }
    else {
      // If we are in seek mode we need to cache the data
      if (this.cacheData === null) {
        this.cacheData = a8;
        this.seekingStartTime = bufferStartTime;
      }
      else {
        // Buffer data locally, append the new data to existing data
        var newCachedData = new Uint8Array(this.cacheData.length + a8.length);
        newCachedData.set(this.cacheData);
        newCachedData.set(a8, this.cacheData.length);
        this.cacheData = newCachedData;
      }

      // Do we have enough data?
      if ((this.seekingStartTime + BUFFERING.SEEK_RESUME) <= bufferEndTime) {
        // If we have enough data append it
        this.sourceBuffer_.append(this.cacheData);
        this.seekingState = seekingState.ENOUGH_DATA;
        dlog(2, 'Seeking State[' + this.mime + ']: ' + this.seekingState);
        // We have pushed the data but let's keep the state in case the data is
        // garbaged collected before it is consumed so we will re-append
        // it will change when we receive the 'seeked' event from the
        // HTML video element
      }
    }

    this.segIndex++;

    if (this.segIndex >= this.representations_[this.currentRep].segs.length) {
      this.active = false;
      dlog(2, 'Source[' + this.mime + '] is not active: ' + this.segIndex +
          ' ' + this.representations_[this.currentRep].segs.length);
    }

    dlog(4, 'Ranges in appendData2: ' + this.getRangesString());
  };



  window.SourceBufferManager = SourceBufferManager;

})();
