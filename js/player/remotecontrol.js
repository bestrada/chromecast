// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview basic RAMP implementation. This is the main file to use to
 * extend the player and hook UI events to the underlying video element.
 */

(function() {
  'use strict';

  log('Initializing Remote Control');
  cast.receiver.logger.setLevelValue(0);

  // This avoids the receiver to be instantiated in standard Chrome
  // so you can still debug media using the console.
  if ((window.navigator.userAgent.indexOf('CrKey') === -1) &&
      (window.navigator.userAgent.indexOf('TV') === -1)) {
    log('Cast is not supported for this device');
    window.player = new BasicPlayer(true);
    window.player.init();
    return;
  }

  var GenericPlayer = function() {
    this.player_ = new BasicPlayer();
    window.player = this.player_;
    this.castApp = new cast.receiver.Receiver(
        'GoogleCastPlayer',
        [cast.receiver.RemoteMedia.NAMESPACE],
        "",
        5);
    this.remoteMedia = new cast.receiver.RemoteMedia();
    this.remoteMedia.addChannelFactory(
        this.castApp.createChannelFactory(
        cast.receiver.RemoteMedia.NAMESPACE));
    this.remoteMedia.setMediaElement(this.player_.getMediaElement());

    // This load handles both regular video/audio element load and MSE style
    // load for adaptive streaming scenarios
    var genericLoad = function(channel, message) {
      dlog(2, 'OnLoad src: ' + message.src);

      if (message.content_info) {
        options.level = message.content_info.level;
        options.algorithm = message.content_info.algorithm;
        options.cc = message.content_info.cc;
      }

      options.autoplay = message.autoplay.toString();

      if (message.src) {
        options.url = message.src;
        options.level = message.level;
        this.player_.init();
      }
    };

    // We have exposed a load method in remoteMedia that allows to simply
    // overload the load itself but the error/success handling is managed by
    // remoteMedia so we do not have to send a response, remoteMedia does for
    // us asynchronously when the load is completed.
    this.remoteMedia.load = genericLoad.bind(this);
  };

  var gp = new GenericPlayer();

  gp.castApp.start();

  window.castApp = gp.castApp;

})();






