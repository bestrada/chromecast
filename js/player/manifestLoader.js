// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview A generic manifest loader.
 */

(function() {

  'use strict';

  var DASH = 0;
  var SMOOTHSTREAMING = 1;

  var ManifestLoader = function(url) {
    if (url == null) {
      throw new Error('A url for the manifest is required');
    }
    this.url_ = url;
    this.callback_ = null;
    this.manifest_ = null;
  };

  ManifestLoader.prototype.load = function(callback) {
    if (callback == null) {
      throw new Error('A callback is required');
    }
    this.callback_ = callback;
    this.requestManifest_();
    dlog(1, 'Sent request to get the manifest');
  };

  ManifestLoader.prototype.getManifest = function() {
    return this.manifest_;
  };


  // Currently this works for dash and Smoothstreaming.
  ManifestLoader.prototype.manifestType_ = function() {
    if (this.url_.lastIndexOf('.mpd') === (this.url_.length - 4)) {
      return DASH;
    }
    else {
      return SMOOTHSTREAMING;
    }
  };

  ManifestLoader.prototype.requestManifest_ = function() {
    var xhr = new XMLHttpRequest();
    xhr.addEventListener('load', this.onManifestLoad_.bind(this));
    xhr.addEventListener('error', this.onManifestError_.bind(this));
    xhr.open('GET', this.url_);
    xhr.send();
  };


  ManifestLoader.prototype.onManifestError_ = function(evt) {
    var error = 'Error retrieving manifest from ' + this.url_;
    log(error);
    return this.callback_(error);
  };

  ManifestLoader.prototype.onManifestLoad_ = function(evt) {
    dlog(2, 'Manifest received');
    var error = null;
    if ((evt.target.status < 200) || (evt.target.status > 299)) {
      error =
          'HTTP error ' + evt.target.status +
          ' retrieving manifest from ' + this.url_;
      log(error);
      return this.callback_(error);
    }

    switch (this.manifestType_()) {
      case DASH:
        this.manifest_ = parseDASHManifest(evt.target.responseText, this.url_);
        break;
      case SMOOTHSTREAMING:
        this.manifest_ = parseSSManifest(evt.target.responseText, this.url_);
        break;
    }

    if (this.manifest_ === null) {
      error = 'Error parsing the manifest';
      log(error);
      return this.callback_(error);
    }

    return this.callback_(error, this.manifest_);

  };

  window.ManifestLoader = ManifestLoader;

})();
