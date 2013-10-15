// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Wrapper for MediaSource to handle seek buffering scenarios.
 */

(function() {

  'use strict';

  var seekingState = {
    NONE: 'none',
    STARTED: 'started',
    ENOUGH_DATA: 'enough_data' };

  var MediaSourceManager = function() {
    this.mediaSrc_ = null;
    this.sourceBufferManagers_ = [];
    this.videoSrcBufIndex_ = 0;
    this.emeMgr_ = null;
    this.type = null;
    this.pr;
    this.seekingState_ = seekingState.NONE;
    this.manifest_ = null;
  };

  MediaSourceManager.prototype.getMediaSource = function() {
    return this.mediaSrc_;
  };

  MediaSourceManager.prototype.dispose = function() {
    if(this.mediaSrc_ != null) {
       this.resetAll();
       this.mediaSrc_ = null;
       this.sourceBufferManagers_ = [];
    }
  };
 
  MediaSourceManager.prototype.getSourceBufferCount = function() {
    return this.sourceBufferManagers_.length;
  };

  MediaSourceManager.prototype.getVideoSrcBufferIndex = function() {
    return this.videoSrcBufIndex_;
  };

  MediaSourceManager.prototype.getLevel = function(index) {
    return this.sourceBufferManagers_[index].currentRep;
  };

  MediaSourceManager.prototype.getSegIndex = function(index) {
    return this.sourceBufferManagers_[index].segIndex;
  };

  // If we are in seek and we have enough buffering for all Source Buffers,
  // return true, false otherwise
  MediaSourceManager.prototype.hasEnoughDataOnSeek = function() {

    if (this.seekingState_ === seekingState.ENOUGH_DATA) {
      return true;
    }

    if (this.seekingState_ === seekingState.NONE) {
      return false;
    }

    var allSourceBuffersHaveEnoughData = true;
    for (var i = 0; i < this.sourceBufferManagers_.length; i++) {
      if (this.sourceBufferManagers_[i].seekingState_ !==
          seekingState.ENOUGH_DATA) {
        allSourceBuffersHaveEnoughData = false;
      }
    }

    if (allSourceBuffersHaveEnoughData) {
      this.seekingState_ = seekingState.ENOUGH_DATA;
    }
  };

  MediaSourceManager.prototype.getSeekingState = function() {
    return this.seekingState_;
  };

  MediaSourceManager.prototype.setStartSeeking = function() {
    this.seekingState_ = seekingState.STARTED;
    for (var i = 0; i < this.sourceBufferManagers_.length; i++) {
      this.sourceBufferManagers_[i].seekingState_ = seekingState.STARTED;
    }
  };

  MediaSourceManager.prototype.setSeekingCompleted = function() {
    this.seekingState_ = seekingState.NONE;
    for (var i = 0; i < this.sourceBufferManagers_.length; i++) {
      this.sourceBufferManagers_[i].seekingState_ = seekingState.NONE;
    }
  };

  MediaSourceManager.prototype.getCurrentRep = function(index) {
    return this.sourceBufferManagers_[index].getCurrentRep();
  };

  MediaSourceManager.prototype.getBufferSize = function(index, currentTime) {
    return this.sourceBufferManagers_[index].getBufferSize(currentTime);
  };

  MediaSourceManager.prototype.getLevel = function(index) {
    return this.sourceBufferManagers_[index].currentRep;
  };

  MediaSourceManager.prototype.appendData = function(index, data) {
    return this.sourceBufferManagers_[index].appendData(data);
  };

  MediaSourceManager.prototype.append = function(index, data) {
    return this.sourceBufferManagers_[index].append(data);
  };

  MediaSourceManager.prototype.isActive = function(index) {
    return this.sourceBufferManagers_[index].active;
  };

  MediaSourceManager.prototype.isInitialized = function(index) {
    return this.sourceBufferManagers_[index].isInitialized();
  };

  MediaSourceManager.prototype.initialize = function(index) {
    this.sourceBufferManagers_[index].initialize();
  };

  MediaSourceManager.prototype.mime = function(index) {
    return this.sourceBufferManagers_[index].mime;
  };

  MediaSourceManager.prototype.getBitrates = function(index) {
    return this.sourceBufferManagers_[index].bitrates;
  };

  MediaSourceManager.prototype.identifyNextFragment =
      function(index, currentTime) {
    return this.sourceBufferManagers_[index].identifyNextFragment(currentTime);
  };

  MediaSourceManager.prototype.resetAll = function(reason) {
    for (var i = 0; i < this.sourceBufferManagers_.length; i++) {
      this.sourceBufferManagers_[i].reset(reason);
    }
  };

  MediaSourceManager.prototype.reset = function(index, reason) {
    this.sourceBufferManagers_[index].reset(reason);
  };

  MediaSourceManager.prototype.changeQuality = function(index, level) {
    return this.sourceBufferManagers_[index].changeQuality(level);
  };

  MediaSourceManager.prototype.areAllActive = function() {
    var active = true;
    for (var i = 0; i < this.mediaSrc_.sourceBuffers.length; i++) {
      if (!this.sourceBufferManagers_[i].active) {
        active = false;
      }
    }

    if (!active && this.mediaSrc_.readyState === 'open') {
      log('Ending stream');
      this.mediaSrc_.endOfStream();
      return false;
    }

    return true;
  };

  MediaSourceManager.prototype.absolutizeURL = function(base, target) {
    if (target.match(/^[a-z]*:\/\//)) return target;
    var rel_url;
    if (target[0] == '/') {
      rel_url = base.match(/^[a-z]*:\/\/[^\/]*/)[0];
    } else {
      rel_url = base.replace(/\/[^\/]*$/, '/');
    }
    return rel_url + target;
  };

  MediaSourceManager.prototype.displaySourceBuffers = function(msg) {
    for (var i = 0; i < this.mediaSrc_.sourceBuffers.length; i++) {
      var buf = this.mediaSrc_.sourceBuffers[i];
      dlog(5, msg + ' SourceBuffer[' + buf.mime + ']: ' + buf.active);
    }
  };

  MediaSourceManager.prototype.normalizeRepresentation = function(repSrc) {
    var rep = {
      'url': this.absolutizeURL(this.manifest_.manifestURL, repSrc.baseURLs[0]),
      'bandwidth': repSrc.bandwidth,
      'width': repSrc.width,
      'height': repSrc.height,
      'sps': repSrc.sps,
      'pps': repSrc.pps,
      'audio_codec_private_data': repSrc.audio_codec_private_data,
      'audio_sample_rate': repSrc.audio_sample_rate
    };

    if (this.type === StreamingType.SMOOTH_STREAMING) {
      rep.segs = repSrc.segs;
      return rep;
    }

    var init = null;
    if (repSrc.segmentList != null) {
      init = repSrc.segmentList.initialization;
      rep.segs = [];
      for (var k = 0; k < repSrc.segmentList.segmentURLs.length; k++) {
        var segSrc = repSrc.segmentList.segmentURLs[k];
        var seg = {
          'start': segSrc.mediaRange.start,
          'end': segSrc.mediaRange.end,
          'index': segSrc.indexRange && segSrc.indexRange.end || null,
          'time': repSrc.segmentList.durationSeconds * k,
          'duration': repSrc.segmentList.durationSeconds,
          'subsegments': null
        };
        rep.segs.push(seg);
      }
    } else {
      // For now, assume VOD profile content
      var seg = {
        'start': null,
        'end': null,
        'index': null,
        'time': 0,
        'duration': this.manifest_.duration,
        'subsegments': null
      };
      if (repSrc.segmentBase != null) {
        var segSrc = repSrc.segmentBase;
        init = segSrc.initialization;
        if (segSrc.indexRange != null) {
          rep.indexRequestData = segSrc.indexRange;
        }
      }
      rep.segs = [seg];
    }

    if (this.type !== StreamingType.SMOOTH_STREAMING) {
      rep.initRequestData = {
        'start': (init && init.start) || 0,
        'end': (init && init.end) || rep.segs[0].index || null
      };
    }
    return rep;
  };

  MediaSourceManager.prototype.onSourceOpen =
      function(video, ccInfo, callback, evt) {
    dlog(2, 'onSourceOpen()');
    var reps,
        buf,
        i,
        j,
        aset;

    if (this.mediaSrc_.sourceBuffers.length) {
      dlog(2, 'onSourceOpen(): Target already has buffers, bailing.');
      for (i = 0; i < this.mediaSrc_.sourceBuffers.length; i++)
        this.mediaSrc_.sourceBuffers[i].active = true;
      return;
    }

    this.mediaSrc_.duration = this.manifest_.duration;
    this.sourceBufferManagers_ = [];
    this.emeMgr_ = new EMEManager(video);
    this.type = this.manifest_.type;
    this.pr = this.manifest_.pr;


    for (i = 0; i < this.manifest_.adaptationSets.length; i++) {
      aset = this.manifest_.adaptationSets[i];

      if (aset.mime && aset.mime.indexOf('webm') >= 0) {
        continue;
      }

      // If the audio and video share the same key this could be optimized and
      // perform a single license call. This may be important if the server
      // is tracking license requests, for example.
      if (aset.contentProtection) {
        this.emeMgr_.init(aset.contentProtection, options.flavor);
      }

      reps = aset.representations.map(this.normalizeRepresentation.bind(this));
      buf =
          this.mediaSrc_.addSourceBuffer(
          aset.mime + '; codecs="' + aset.codecs + '"');
      dlog(
          2, 'Buffer added properly: ' +
          (this.mediaSrc_.sourceBuffers[i] === buf));

      var sourceBufferManager =
          new SourceBufferManager(
          this.mediaSrc_, buf, reps, aset.mime, this.type, this.pr);
      if (aset.mime.indexOf('video') >= 0) {
        this.videoSrcBufIndex_ = i;
      }
      this.sourceBufferManagers_.push(sourceBufferManager);

      dlog(2, 'onSourceOpen. Initialized SourceBuffer[' + aset.mime + ']');
    }

    callback();
  };

  MediaSourceManager.prototype.isSupported = function(video) {
    if ((window.MediaSource == null) && (window.WebKitMediaSource == null)) {
      return false;
    }

    if (window.MediaSource == null) {
      window.MediaSource = window.WebKitMediaSource;
    }

    return true;
  };

  MediaSourceManager.prototype.init = function() {
    this.mediaSrc_ = new MediaSource();
  };

  MediaSourceManager.prototype.attach =
      function(video, manifest, ccInfo, callback) {
    if (!this.mediaSrc_) {
      throw new Error(
          'MediaSourceManager has not been initialized, please call init()');
    }
    this.manifest_ = manifest;
    this.mediaSrc_.addEventListener('sourceopen', this.onSourceOpen.bind(
        this, video, ccInfo, callback));
    this.mediaSrc_.addEventListener('webkitsourceopen', this.onSourceOpen.bind(
        this, video, ccInfo, callback));
    video.src = window.URL.createObjectURL(this.mediaSrc_);
  };



  window.MediaSourceManager = MediaSourceManager;

})();
