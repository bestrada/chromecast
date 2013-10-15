// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Manages the download of fragments from the server.
 */

(function() {

  'use strict';

  var FragmentManager =
      function(mediaSourceManager, bufferIndex, adaptiveManager) {
    this.mediaSrcMgr_ = mediaSourceManager;
    this.bufferIndex_ = bufferIndex;
    this.adaptiveManager_ = adaptiveManager;
    this.fragmentRequest_ = null;
  };

  var BUFFERING = {
    ENOUGH: 20,
    SAFE: 5,
    LOW: 2,
    AUTO_PAUSE_START: 1,
    PAUSE_RESUME: 5,
    SEEK_RESUME: 5
  };

  FragmentManager.prototype.appendInit = function() {
    dlog(2, 'Appending init [' +
        this.mediaSrcMgr_.mime(this.bufferIndex_) + ']: ' +
        this.mediaSrcMgr_.getLevel(this.bufferIndex_));
    this.mediaSrcMgr_.initialize(this.bufferIndex_);
    this.mediaSrcMgr_.append(this.bufferIndex_,
        this.mediaSrcMgr_.getCurrentRep(this.bufferIndex_).initFragment);
  };

  FragmentManager.prototype.onXHRAbort = function(evt) {
    log('Received abort of XHR.');
  }

  FragmentManager.prototype.onXHRError = function(evt) {
    if (this.fragmentRequest_ !== evt.target) {
      log('Received error of untracked XHR.');
      return;
    }

    log('Received error of XHR.');
    this.fragmentRequest_ = null;
  }

  FragmentManager.prototype.onXHRLoad = function(evt) {
    // Assert
    if (this.fragmentRequest_ !== evt.target) {
      log('Error, HTTP response for unknown request');
    }

    var fragmentRequest = this.fragmentRequest_;
    this.fragmentRequest_ = null;

    if (fragmentRequest.readyState != fragmentRequest.DONE) {
      return;
    }

    if (fragmentRequest.status >= 300) {
      log('HTTP Request failure, status=' + fragmentRequest.status);
      return;
    }

    if (fragmentRequest.is_index) {
      dlog(2, 'Index Response');
      this.mediaSrcMgr_.getCurrentRep(this.bufferIndex_).segs =
          parseSIDX(fragmentRequest.response, fragmentRequest.startByte);
    }

    if (fragmentRequest.is_init) {
      dlog(2, 'Init Response');
      this.mediaSrcMgr_.getCurrentRep(this.bufferIndex_).initFragment =
          extractInit(fragmentRequest.response);

      if (!this.mediaSrcMgr_.isInitialized(this.bufferIndex_)) {
        this.appendInit();
      }

      return;
    }

    ////////////////////////////////////////////////////////////////////

    this.mediaSrcMgr_.appendData(this.bufferIndex_, fragmentRequest.response);
  };

  FragmentManager.prototype.cancelRequests = function() {
    if (this.fragmentRequest_ != null) {
      this.fragmentRequest_.abort();
      this.fragmentRequest_ = null;
    }
  };

  FragmentManager.prototype.makeSSXHR = function() {
    var xhr = new XMLHttpRequest();

    var segIndex = this.mediaSrcMgr_.getSegIndex(this.bufferIndex_);
    var url = this.mediaSrcMgr_.getCurrentRep(this.bufferIndex_).url;
    var bitrate = this.mediaSrcMgr_.getCurrentRep(this.bufferIndex_).bandwidth;
    var startTime =
        this.mediaSrcMgr_.getCurrentRep(
        this.bufferIndex_).segs[segIndex].timeURL;

    url = url.replace('{bitrate}', bitrate);
    url = url.replace('{start time}', startTime);

    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.addEventListener('load', this.onXHRLoad.bind(this));
    xhr.addEventListener('error', this.onXHRError.bind(this));
    xhr.addEventListener('abort', this.onXHRAbort.bind(this));
    if (url == null) throw 'Null URL';
    xhr.is_init = false;
    xhr.is_index = false;
    xhr.lastTime = null;
    xhr.lastSize = null;
    xhr.addEventListener('progress',
        this.adaptiveManager_.onBandwithTracking.bind(this.adaptiveManager_));
    xhr.send();
    dlog(2, 'Sent XHR: url=' + url);
    return xhr;
  };

  FragmentManager.prototype.makeXHR = function(isInitSegment) {
    var xhr = new XMLHttpRequest();
    var segIndex = this.mediaSrcMgr_.getSegIndex(this.bufferIndex_);
    var rep = this.mediaSrcMgr_.getCurrentRep(this.bufferIndex_);
    var url = this.mediaSrcMgr_.getCurrentRep(this.bufferIndex_).url;
    var seg = this.mediaSrcMgr_.getCurrentRep(this.bufferIndex_).segs[segIndex];
    var start;
    var end;
    var is_index = false;

    if (isInitSegment) {
      // This makes the assumption that the
      // initialization segment comes at the beginning of the file
      start = 0;
      end = rep.initRequestData.end;
      // If there is an index section let's request both together
      if (rep.indexRequestData != null) {
        end = rep.indexRequestData.end;
        is_index = true;
      }
    }
    else {
      start = seg.offset;
      end = seg.offset + seg.size - 1;
    }



    var range = null;
    if (start != null && end != null) {
      range = 'bytes=' + start + '-' + end;
    }

    var useArg = !!/youtube.com/.exec(url);
    if (range && useArg) {
      url = url.replace(/&range=[^&]*/, '');
      url += '&range=' + range.substring(6);
    }
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.startByte = start;
    if (range != null && !useArg) xhr.setRequestHeader('Range', range);
    xhr.addEventListener('load', this.onXHRLoad.bind(this));
    if (url == null) throw 'Null URL';
    xhr.is_init = isInitSegment;
    xhr.is_index = is_index;
    xhr.lastTime = null;
    xhr.lastSize = null;
    xhr.addEventListener('progress',
        this.adaptiveManager_.onBandwithTracking.bind(this.adaptiveManager_));
    xhr.send();
    dlog(2, 'Sent XHR: url=' + url + ', range=' + range);
    return xhr;
  };

  FragmentManager.prototype.findRangeForPlaybackTime = function(buf, time) {
    var ranges = buf.buffered;
    for (var i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= time && ranges.end(i) >= time) {
        return {'start': ranges.start(i), 'end': ranges.end(i)};
      }
    }
  };

  FragmentManager.prototype.initFragmentRequestNeeded = function() {

    // Do we need to initialize for this representation?
    if (this.mediaSrcMgr_.getCurrentRep(
        this.bufferIndex_).initFragment == null) {

      dlog(2, 'Creating Init segment[' +
          this.mediaSrcMgr_.mime(this.bufferIndex_) + ']');
      var rep = this.mediaSrcMgr_.getCurrentRep(this.bufferIndex_);

      if (this.mediaSrcMgr_.type === StreamingType.SMOOTH_STREAMING) {

        // SmoothStreaming does not have init segment. Let's create one

        var mInfo = {
          pps: rep.pps,
          sps: rep.sps,
          width: rep.width,
          height: rep.height,
          mime: this.mediaSrcMgr_.mime(this.bufferIndex_),
          pr: this.mediaSrcMgr_.pr,
          audio_codec_private_data: rep.audio_codec_private_data,
          audio_sample_rate: rep.audio_sample_rate
        };

        var initObj = createSSInit(mInfo);
        this.mediaSrcMgr_.getCurrentRep(this.bufferIndex_).initFragment =
            extractInit(initObj.data);

        this.appendInit();

        // We do not need a HTTP request to the server
        return false;
      }
      else {

        this.fragmentRequest_ = this.makeXHR(true);
        return true;
      }
    }

    // After a Source Buffer reset we need to reinitialize the Source Buffer
    if (!this.mediaSrcMgr_.isInitialized(this.bufferIndex_)) {
      this.appendInit();
    }

    return false;
  };

  FragmentManager.prototype.requestNextFragment =
      function(currentTime, nextTime) {

    if (this.mediaSrcMgr_.type ===
        StreamingType.SMOOTH_STREAMING) {
      this.fragmentRequest_ = this.makeSSXHR();
    }
    else {
      this.fragmentRequest_ = this.makeXHR(false);
    }

    // For validation
    this.fragmentRequest_.expected_time = nextTime;
  };

  // Returns false if not active
  FragmentManager.prototype.tick = function(currentTime) {

    if (!this.mediaSrcMgr_.isActive(this.bufferIndex_)) {
      dlog(2, 'Not active[' + this.mediaSrcMgr_.mime(this.bufferIndex_) + ']');
      return false;
    }

    if (this.fragmentRequest_) {
      dlog(4, 'Will not request next segment[' +
          this.mediaSrcMgr_.mime(this.bufferIndex_) + '] request pending');
    }
    else if (!this.initFragmentRequestNeeded()) {
      var nextTime = this.mediaSrcMgr_.identifyNextFragment(
          this.bufferIndex_, currentTime);
      if (nextTime !== null) {

        var newLevel = -1;

        if (this.mediaSrcMgr_.mime(this.bufferIndex_).indexOf('video') >= 0) {
          newLevel = this.adaptiveManager_.adapt(
              this.mediaSrcMgr_.getLevel(this.bufferIndex_));
        }

        if (newLevel >= 0) {
          this.cancelRequests();
          this.mediaSrcMgr_.changeQuality(this.bufferIndex_, newLevel);
        }
        else {
          this.requestNextFragment(currentTime, nextTime);
        }
      }
    }

    return true;
  };

  window.FragmentManager = FragmentManager;

})();
