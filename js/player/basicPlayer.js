// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview A generic basic html player to support multiple media formats.
 */

(function() {

  'use strict';

  var MediaType = {
    Audio_Type: 'audio',
    Video_Type: 'video',
    Image_Type: 'img',
    MSE_Type: 'mse'
  };

  var BasicPlayer = function(showControls) {
    this.mediaElementType_ = null;
    this.manifestLoader_ = null;
    this.closeCaptionsLoader_ = null;
    this.progressTimer_ = null;
    this.mediaSrcMgr_ = new MediaSourceManager();
    this.fragmentManagers_ = null;
    this.showControls_ = showControls;
    this.mediaElement_ = null;
    this.imageElement_ = null;
    this.createMediaElement();
  };

  var BUFFERING = {
    // Time required to continue playing (otherwise we autopause).
    AUTO_PAUSE_START: 1,
    // Time required to resume from autopause.
    PAUSE_RESUME: 5
  };

  function pair(a, b) {
    return '[' + a + ',' + b + ']';
  }

  function inRange(val, a, b) {
    return ((val >= a) && (val <= b));
  }

  function inRangeR(val, range) {
    return ((val >= range.start) && (val <= range.end));
  }

  function getURLQueryParameter(name) {
    var re = new RegExp('[?&]' + name + '=([^&]*)');
    var result = re.exec(window.location.search);
    if (result != null) {
      result = result[1];
      if (/%/.exec(result)) result = decodeURIComponent(result);
      return result;
    }
    return null;
  }

  function clearCaptionInfo(vid) {
    if (vid.textTracks.length > 0) {
      for (var i = 0; i < vid.textTracks.length; i++) {
        for (var j = vid.textTracks[i].cues.length - 1; j >= 0; j--) {
          vid.textTracks[i].removeCue(vid.textTracks[i].cues[j]);
        }
      }
    }
  }

  var options = {};
  window.options = options;

  function readQueryParameters() {
    var qparams = {};
    var opts = ['autoplay', 'algorithm', 'flavor', 'level', 'cc', 'url'];
    for (var i = 0; i < opts.length; i++) {
      var val = getURLQueryParameter(opts[i]);
      qparams[opts[i]] = val;
    }

    if (qparams && qparams.url) {
      for (var prop in qparams) {
        if (qparams.hasOwnProperty(prop)) {
          options[prop] = qparams[prop];
        }
      }
    }
  }

  BasicPlayer.prototype.getMediaElement = function() {
    return this.mediaElement_;
  };

  BasicPlayer.prototype.onPause = function(evt) {
    log('Paused, auto=' + this.mediaElement_.autopause_pending);
    this.mediaElement_.autopaused = this.mediaElement_.autopause_pending;
    this.mediaElement_.autopause_time = new Date().getTime();
    this.mediaElement_.autopause_pending = false;
  };

  BasicPlayer.prototype.onPlay = function(evt) {
    log('Playing');
    this.mediaElement_.autopause_pending = false;
    this.mediaElement_.autopaused = false;
    this.mediaElement_.autopause_time = null;
  };

  BasicPlayer.prototype.onError = function(evt) {
    log('Error (' + this.mediaElement_.error.code + ')');
  };

  BasicPlayer.prototype.cancelRequests = function() {
    for (var i = 0; i < this.fragmentManagers_.length; i++) {
      this.fragmentManagers_[i].cancelRequests();
    }
  };

  BasicPlayer.prototype.onSeeking = function(evt) {
    log('Seeking');
    this.cancelRequests();
    this.mediaSrcMgr_.resetAll('seeking');
    this.mediaSrcMgr_.setStartSeeking();
  };

  BasicPlayer.prototype.onSeeked = function(evt) {
    log('Seeked');
    this.mediaSrcMgr_.setSeekingCompleted();
  };


  BasicPlayer.prototype.onProgress = function() {
    var currentTime = this.mediaElement_.currentTime;
    var msrc = this.mediaSrcMgr_.getMediaSource();
    if (msrc.readyState != 'open' && !!this.progressTimer_) {
      dlog(2, 'Deregistering progress timer');
      window.clearInterval(this.progressTimer_);
      this.progressTimer_ = null;
      return;
    }

    if (this.mediaElement_.error) {
      dlog(2, 'Video Error: ' + this.mediaElement_.error);
      return;
    }

    // We need to calculate cross-state across multiple
    // SourceBuffers (video, audio)
    var not_enough_buffered = true;
    var active = false;
    var seeking_status_enough_data = true;

    for (var i = 0; i < this.fragmentManagers_.length; i++) {
      if (!this.fragmentManagers_[i].tick(currentTime)) {
        continue;
      }

      active = true;
      var bufferSize = this.mediaSrcMgr_.getBufferSize(i, currentTime);

      if (this.mediaElement_.paused) {
        if (bufferSize >= BUFFERING.PAUSE_RESUME) {
          // Ready to resume after autopause
          not_enough_buffered = false;
        }
      }
      else {
        if (bufferSize >= BUFFERING.AUTO_PAUSE_START) {
          // Autopause not needed
          not_enough_buffered = false;
        }
      }
    }

    // If we are seeking and we have enough seek data we have enough buffered
    if (this.mediaSrcMgr_.hasEnoughDataOnSeek()) {
      not_enough_buffered = false;
    }

    if (!this.mediaSrcMgr_.areAllActive()) {
      return;
    }

    if (this.mediaElement_.paused) {
      dlog(
          4,
          'Current state is paused. Auto paused = ' +
          this.mediaElement_.autopaused);
      if (this.mediaElement_.autopaused) {
        if (!not_enough_buffered) {
          dlog(2, 'Autoresuming');
          this.mediaElement_.play();
        }
      }
    }
    else if (not_enough_buffered) {
      dlog(2, 'Autopausing');
      this.mediaElement_.autopause_pending = true;
      this.mediaElement_.pause();
    }
  };

  BasicPlayer.prototype.createMediaElement = function() {
    var container = document.getElementById('mediaElement');

    // Add a video and a img tag but hide the img when audio or video is on
    this.mediaElement_ = document.createElement(MediaType.Video_Type);
    this.imageElement_ = document.createElement(MediaType.Image_Type);

    container.appendChild(this.mediaElement_);
    container.appendChild(this.imageElement_);

    // For debugging:
    window.me = this.mediaElement_;
    window.img = this.imageElement_;

    if (this.showControls_) {
      if (!this.mediaElement_.hasAttribute('controls')) {
        this.mediaElement_.setAttribute('controls', 'controls');
      }
    }
    else {
      if (this.mediaElement_.hasAttribute('controls')) {
        this.mediaElement_.removeAttribute('controls');
      }
    }
  };

  BasicPlayer.prototype.showMediaElement = function(mediaType) {
    var container = document.getElementById('mediaElement');
 
    // If we were a MSE let's clean up properly
    if ((mediaType !== MediaType.MSE_Type) &&
        (this.mediaElementType_ === MediaType.MSE_Type)) {
        this.mediaElement_.removeEventListener('seeking', this.onSeeking.bind(this));
        this.mediaElement_.removeEventListener('seeked', this.onSeeked.bind(this));
        this.mediaElement_.removeEventListener('pause', this.onPause.bind(this));
        this.mediaElement_.removeEventListener('play', this.onPlay.bind(this));
        this.mediaElement_.removeEventListener('error', this.onError.bind(this));
        if(this.progressTimer_) {
           clearInterval(this.progressTimer_);
        }
        this.mediaSrcMgr_.dispose();
        this.mediaSrcMgr_ = new MediaSourceManager();
    }
 
    if (this.mediaElementType_ !== MediaType.Image_Type) {
        this.mediaElement_.play(0);
        this.mediaElement_.pause();
    }
 
    var nodes = container.children;
    if (nodes && (nodes.length > 0)) {
      for (var i = 0; i < nodes.length; i++) {
 
        if ((nodes[i].nodeName === 'VIDEO') &&
                (mediaType !== MediaType.Image_Type)) {
          nodes[i].style.display = 'block';
        }
        else if ((nodes[i].nodeName === 'IMG') &&
                (mediaType === MediaType.Image_Type)) {
          nodes[i].style.display = 'block';
        }
        else {
          nodes[i].style.display = 'none';
          nodes[i].src = null;
        }
      }
    }
 
    this.mediaElementType_ = mediaType;
  };

  BasicPlayer.prototype.initMseVideoElement = function(ccInfo) {
    // Add Close Captions
    if (ccInfo) {
      this.addCaptionInfo(ccInfo);
    }

    this.mediaElement_.addEventListener('seeking', this.onSeeking.bind(this));
    this.mediaElement_.addEventListener('seeked', this.onSeeked.bind(this));
    this.mediaElement_.addEventListener('pause', this.onPause.bind(this));
    this.mediaElement_.addEventListener('play', this.onPlay.bind(this));
    this.mediaElement_.addEventListener('error', this.onError.bind(this));

    // True if the next 'pause' event will be (or is expected to be) generated
    // as a result of automatic pausing, such as a buffer stall. Setting this
    // masks the next pause event from changing the user's paused state.
    this.mediaElement_.autopause_pending = false;

    // True if the reason for the video being paused was not the result of user
    // action, and the video is currently paused.
    if (options.autoplay && (options.autoplay === 'true')) {
      this.mediaElement_.autopaused = true;
    }
    else {
      this.mediaElement_.autopaused = false;
    }

    this.mediaElement_.seekingStatus = 'none';
  };

  BasicPlayer.prototype.onManifestLoad = function(error) {
    if (error) {
      log('Unable to load manifest');
      return;
    }

    if (options.cc) {
      this.closeCaptionsLoader_ = new CloseCaptionsLoader(options.cc);
      this.closeCaptionsLoader_.load(
          this.onLoadcloseCaptions.bind(this));
    } else {
      this.onLoadcloseCaptions.call(this);
    }
  };

  //Adds caption info to a video
  BasicPlayer.prototype.addCaptionInfo = function(ccInfo) {
    var tt;
    if (this.mediaElement_.textTracks.length > 0) {
      tt = this.mediaElement_.textTracks[0];
    }
    else {
      tt = this.mediaElement_.addTextTrack('captions');
    }

    tt.mode = 'showing';
    var s = ccInfo[0].start;
    var e = ccInfo[0].end;
    var sameFrame = [];
    for (var i = 0; i < ccInfo.length; i++) {
      var cue = new TextTrackCue(
          ccInfo[i].start, ccInfo[i].end, ccInfo[i].caption);
      if ((s === ccInfo[i].start) && (e === ccInfo[i].end)) {
        // Same block
        sameFrame.push(cue);
      }

      if ((s !== ccInfo[i].start) || (e !== ccInfo[i].end) ||
          (i === ccInfo.length - 1)) {
        for (var j = sameFrame.length - 1; j >= 0; j--) {
          tt.addCue(sameFrame[j]);
        }
        sameFrame.length = 0;
        // New block
        s = ccInfo[i].start;
        e = ccInfo[i].end;

        if (i < ccInfo.length) {
          sameFrame.push(cue);
        }
      }
    }
  };

  BasicPlayer.prototype.onMediaSourceManagerInitialized = function(ccInfo) {

    this.initMseVideoElement(ccInfo);

    // Init Fragment Managers
    for (var i = 0; i < this.mediaSrcMgr_.getSourceBufferCount(); i++) {
      this.fragmentManagers_.push(
          new FragmentManager(this.mediaSrcMgr_, i,
          new AdaptiveManager(
          this.mediaSrcMgr_.getBitrates(i), options.algorithm, options.level)));
    }

    // Add player loop
    if (!this.progressTimer_) {
      this.progressTimer_ =
          setInterval(this.onProgress.bind(this), 250);
    }
  };

  BasicPlayer.prototype.initializeMsePlayer = function(error) {
    var ccInfo = null;

    if (this.closeCaptionsLoader_) {
      ccInfo = this.closeCaptionsLoader_.getCCInfo();
    }

    this.fragmentManagers_ = [];
    this.mediaSrcMgr_.init();

    window.msrc = this.mediaSrcMgr_.getMediaSource();

    this.mediaSrcMgr_.attach(
        this.mediaElement_, this.manifestLoader_.getManifest(), ccInfo,
        this.onMediaSourceManagerInitialized.bind(this, ccInfo));

  };

  BasicPlayer.prototype.initializeSimplePlayer = function(mediaType, src) {
    if (mediaType !== MediaType.Image_Type) {
      this.mediaElement_.src = src;
      this.mediaElement_.play();
    }
    else {
      this.imageElement_.src = src;
    }
  };

  BasicPlayer.prototype.onLoadcloseCaptions = function(error) {

    if (error) {
      log('Unable to load close captions');
      return;
    }

    this.initializeMsePlayer();
  };

  BasicPlayer.prototype.onManifestLoad = function(error) {
    if (error) {
      log('Unable to load manifest');
      return;
    }

    if (options.cc) {
      this.closeCaptionsLoader_ = new CloseCaptionsLoader(options.cc);
      this.closeCaptionsLoader_.load(
          this.onLoadcloseCaptions.bind(this));
    } else {
      this.onLoadcloseCaptions.call(this);
    }
  };

  BasicPlayer.prototype.getMediaType = function(url) {
    var length = url.length;
    if (length < 5) {
      log('Error invalid url');
      return null;
    }

    var ext = url.substring(url.length - 4, url.length);

    switch (ext) {
      case '.webm' :
      case '.mkv' :
      case '.mp4' :
        return MediaType.Video_Type;
        break;
      case '.mp3' :
        return MediaType.Audio_Type;
        break;
      case '.jpg' :
        return MediaType.Image_Type;
        break;
      case '.mpd' :
        return MediaType.MSE_Type;
        break;
      default:
        return MediaType.MSE_Type;
    }
  };


  /**
 * Inititalizes a SimplePlayer.
 */
  BasicPlayer.prototype.init = function() {
    log('-------- Initializing --------');

    if (!this.mediaSrcMgr_.isSupported()) {
      log('Incompatible browser: Media Source extensions not suported');
      return false;
    }

    readQueryParameters();

    if (options.url) {
      var mediaType = this.getMediaType(options.url);
      this.showMediaElement(mediaType);

      if (mediaType === MediaType.MSE_Type) {
        this.manifestLoader_ = new ManifestLoader(options.url);
        this.manifestLoader_.load(this.onManifestLoad.bind(this));
      }
      else {
        this.initializeSimplePlayer(mediaType, options.url);
      }

    } else {
      log('No manifest URL found, please provide one');
      return false;
    }
  };

  window.BasicPlayer = BasicPlayer;

})();
