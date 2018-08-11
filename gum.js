(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.gum = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  //
  // debugging & helper functions
  //
  var debug = true;
  function dlog(e) {
    if (debug) {
      var args = Array.from(arguments);
      var text = '';
      args.forEach(function(arg){
        //if (typeof arg === 'object' && arg.constructor != Array) {
        if (typeof arg === 'object') {
          if (text == '') {
            console.log(arg);
          } else {
            console.log(text);
            text = '';
            console.log(arg);
          }
        } else {
          //console.log(typeof arg, arg.constructor);
          text = text + ' ' + arg;
        }
      });
      if (text != '') {
        console.log(text);
      }
    }
  }
  function catchError(error) {
    console.error(error);
  }
  function wait(delayInMS) {
    return new Promise(resolve => setTimeout(resolve, delayInMS));
  }


  var devicesBoolean = true;


  //
  // ideal width&height, and audio boolean
  //
  var ideals = {
    idealdidth: 4096,
    idealHeight: 2160
  };
  var audioYN = false;
  function setIdeals(obj) {
    if (obj.hasOwnProperty('idealWidth')) ideals.idealWidth = obj.idealWidth;
    if (obj.hasOwnProperty('idealHeight')) ideals.idealHeight = obj.idealHeight;
    if (obj.hasOwnProperty('audio')) audioYN = obj.audio;
  }

  //
  // the elements needed - video for the stream, canvas & img for showing the image
  //
  var els = {};
  function setVidEl(selector) {
    els.videoEl = document.querySelector(selector);
    els.videoEl.setAttribute('autoplay', true);
    els.videoEl.setAttribute('mute', true);
  }
  function setCanvasEl(selector) {
    els.canvasEl = document.querySelector(selector);
    els.ctx = els.canvasEl.getContext('2d');
  }
  function setImgEl(selector) {
    els.imgEl = document.querySelector(selector);
  }
  function setVidOutputEl(selector) {
    els.videoOutputEl = document.querySelector(selector);
  }
  function setupEls(video, canvas, img, vidOutput) {
    setVidEl(video);
    setCanvasEl(canvas);
    setImgEl(img);
    setVidOutputEl(vidOutput);
  }

  //
  // functions and variables for handling the stream
  //
  var currentStream;
  var devicesList = [];
  var deviceValue = '';
  function stopMediaTracks() {
    currentStream.getTracks().forEach(function(track) {
      track.stop();
    });
  }
  function gotDevices(mediaDevices){
    //var list = [{id:'',name:'Default'}];
    var list = [];
    var count = 1;
    mediaDevices.forEach(function(mediaDevice){
      if (mediaDevice.kind === 'videoinput') {
        devicesBoolean = true;
        var newdevice = {};
        newdevice.id = mediaDevice.deviceId;
        newdevice.name = mediaDevice.label || 'Camera ' + count;
        count++;
        list.push(newdevice);
        console.log(mediaDevice);
      }
    });
    devicesList = list;
    dlog(window.gum.devicesList, list);
    if (deviceValue == '') {
      deviceValue = devicesList[0].id;
      //console.log('dv',this.devicevalue);
    }
  }
  function loadit(constraints) {
    if (typeof currentStream !== 'undefined') {
      stopMediaTracks();
    }

    var videoConstraints = {
      width: { ideal: ideals.idealWidth },
      height: { ideal: ideals.idealHeight }
    };
    if (deviceValue === '') {
      videoConstraints.facingMode = 'environment';
    } else {
      videoConstraints.deviceId = { exact: deviceValue };
    }
    dlog(videoConstraints);
    constraints = constraints || {
      video: videoConstraints,
      audio: audioYN
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(function(stream){
      currentStream = stream;
      els.videoEl.srcObject = stream;
      return navigator.mediaDevices.enumerateDevices();
    }).then(gotDevices)
      .catch(catchError);
  }

  //
  // capturing photos & videos
  //
  var captureMode = 'photo';
  function cm(e) {
    captureMode = e;
    return captureMode;
  }
  var rec = {
    //recorder: ,
    //recorded: ,
    //stopped: ,
    data: []
  };
  function snap() {
    if (captureMode == 'photo') {
      dlog('photo', window.gum, captureMode + 'd');
      if (els.videoEl.videoWidth > 0) {
        els.canvasEl.width = els.videoEl.videoWidth;
        els.canvasEl.height = els.videoEl.videoHeight;
        els.ctx.drawImage(els.videoEl, 0, 0);
        var data = els.canvasEl.toDataURL('image/png');
        els.imgEl.setAttribute('src', data);
      }
    }
    if (captureMode == 'video') {
      if (!rec.active) {
//        dlog(rec.active, 'rec.active');
        rec.active = true;
        
        els.videoOutputEl.classList.add('hide');
        els.imgEl.classList.add('hide');
        
        rec.recorder = new MediaRecorder(currentStream);
        rec.data = [];
        rec.recorder.ondataavailable = function(event) {
          rec.data.push(event.data);
        };
        rec.recorder.start();

        rec.stopped = new Promise(function(resolve,reject){
          rec.recorder.onstop = resolve;
          rec.recorder.onerror = function(event){reject(event);};
        });
      } else {
//        dlog(rec.active);
        rec.recorded = wait(1).then(function(){
          dlog('recorded');
          //rec.recorder.state == 'recording' && rec.recorder.stop();
          rec.recorder.stop();
          return rec.data;
        });
        Promise.all([rec.stopped, rec.recorded])
          .then(function(recordedChunks){
          console.log(recordedChunks);
          console.log(rec.data[0]);
          var recordedBlob = new Blob(recordedChunks[1], {type:'video/webm'});
          console.log(recordedBlob);
          els.videoOutputEl.src = window.URL.createObjectURL(recordedBlob);
          els.videoOutputEl.classList.remove('hide');
          //          els.videoOutputEl.src = window.URL.createObjectURL(rec.data[1]);
          //video/webm\;codecs=h264
        }).catch(catchError);
        rec.active = false;
      }
    }
  }

  function clearPhoto(){
    els.ctx.fillStyle = '#AAA';
    els.ctx.fillRect(0,0,els.canvasEl.width, els.canvasEl.height);
    var data = els.canvasEl.toDataURL('image/png');
    els.imgEl.setAttribute('src', data);
  }

  function startSetup() {
    navigator.mediaDevices.enumerateDevices()
      .then(gotDevices)
      .catch(catchError);
    clearPhoto();
  }

  return {
    setupEls: setupEls,
    devicesList: devicesList,
    setIdeals: setIdeals,
    loadit: loadit,
    snap: snap,
    clearPhoto: clearPhoto,
    startSetup: startSetup,
    debug: debug,
    rec: rec,
    captureMode: captureMode,
    dlog: dlog,
    cm: cm
  };
}));
