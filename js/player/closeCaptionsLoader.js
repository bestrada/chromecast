// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview A close captions loader.
 */

(function() {

  'use strict';

  var TTML = 0;
  var VTT = 1;

  /**
 * CloseCaptionsLoader requests and processes close caption files.
 *
 * @constructor
 */
  var CloseCaptionsLoader = function(url) {
    if (url == null) {
      throw new Error('A url for the close captions location is required');
    }
    this._url = url;
    this._callback = null;
    this._ccInfo = null;
  };

  // Here we should add support for VTT, it is trivial
  CloseCaptionsLoader.prototype.ccType = function() {
    return TTML;
  };

  CloseCaptionsLoader.prototype.requestCC = function() {
    var xhr = new XMLHttpRequest();
    xhr.addEventListener('load', this.onCCLoad.bind(this));
    xhr.addEventListener('error', this.onCCError.bind(this));
    xhr.open('GET', this._url);
    xhr.send();
  };

  CloseCaptionsLoader.prototype.load = function(callback) {
    if (callback == null) {
      throw new Error('A callback is required');
    }
    this._callback = callback;
    this.requestCC();
    dlog(1, 'Sent request to get the close captions info');
  };

  CloseCaptionsLoader.prototype.getCCInfo = function() {
    return this._ccInfo;
  };

  CloseCaptionsLoader.prototype.onCCError = function(evt) {
    var error = 'Error geting captions from ' + this._url;
    log(error);
    return this._callback(error);
  };

  CloseCaptionsLoader.prototype.onCCLoad = function(evt) {
    dlog(2, 'Close Captions Info received');
    var error = null;
    if ((evt.target.status !== 200) || (evt.target.status > 299)) {
      error =
          'HTTP error ' + evt.target.status +
          ' retrieving close captions from ' + this._url;
      log(error);
      return this._callback(error);
    }

    switch (this.ccType()) {
      case TTML:
        this._ccInfo = new Ttml(evt.target.responseText).parse();
        break;
      case VTT:
        throw new Error('VTT parsing not implemented yet');
        break;
    }

    if (this._ccInfo === null) {
      error = 'Error parsing the close captions info';
      log(error);
      return this._callback(error);
    }

    return this._callback(error, this._ccInfo);

  };

  window.CloseCaptionsLoader = CloseCaptionsLoader;

})();
