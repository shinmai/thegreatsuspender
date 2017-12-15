/*global chrome, html2canvas */
/*
 * The Great Suspender
 * Copyright (C) 2017 Dean Oemcke
 * Available under GNU GENERAL PUBLIC LICENSE v2
 * http://github.com/deanoemcke/thegreatsuspender
 * ლ(ಠ益ಠლ)
*/
(function () {
    'use strict';

    var inputState = false,
        editedInputControls = [],
        tempWhitelist = false,
        timerJob,
        suspendDateTime = false,
        shouldSuspendTab = false;

    function suspendTab(suspendedUrl) {
        window.location.replace(suspendedUrl);
    }

    function handlePreviewSuccess(dataUrl, timer, sendResponseCallback) {
        if (!shouldSuspendTab) {
            sendResponseCallback({
                cancelled: true,
                timerMsg: timer
            });
            return;
        }
        sendResponseCallback({
            previewUrl: dataUrl,
            timerMsg: timer
        });
    }

    function handlePreviewError(err, sendResponseCallback) {
        if (!shouldSuspendTab) {
            sendResponseCallback({
                cancelled: true
            });
            return;
        }
        sendResponseCallback({
            previewUrl: false,
            errorMsg: err
        });
    }

    function generatePreviewImg(screenCapture, forceScreenCapture, sendResponseCallback) {
        var elementCount = document.getElementsByTagName('*').length,
            processing = true,
            timer = new Date(),
            height = 0;

        //safety check here. don't try to use html2canvas if the page has more than 10000 elements
        if (forceScreenCapture || elementCount < 10000) {

            //check where we need to capture the whole screen
            if (screenCapture === '2') {
                height = Math.max(window.innerHeight,
                    document.body.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.clientHeight,
                    document.documentElement.scrollHeight,
                    document.documentElement.offsetHeight);
                // cap the max height otherwise it fails to convert to a data url
                height = Math.min(height, 10000);
            } else {
                height = window.innerHeight;
            }

            //allow max of 30 seconds to finish generating image (or 5 mins if forceScreenCapture is true)
            var timeout = forceScreenCapture ? (5 * 60 * 1000) : (30 * 1000);
            window.setTimeout(function () {
                if (processing) {
                    processing = false;
                    handlePreviewError(timeout + 'ms timeout reached', sendResponseCallback);
                }
            }, timeout);

            html2canvas(document.body, {
                height: height,
                width: document.body.clientWidth,
                scale: window.devicePixelRatio,
                imageTimeout: 1000,
                async: true,
                onrendered: function (canvas) {
                    if (processing) {
                        processing = false;
                        var dataUrl = canvas.toDataURL('image/webp', 0.8);
                        if (!dataUrl || dataUrl === 'data:,') {
                            dataUrl = canvas.toDataURL();
                        }
                        if (!dataUrl || dataUrl === 'data:,') {
                            handlePreviewError('Failed to generate dataUrl', sendResponseCallback);
                        } else {
                            timer = (new Date() - timer) / 1000;
                            handlePreviewSuccess(dataUrl, timer, sendResponseCallback);
                        }
                    }
                }
            });

        } else {
            handlePreviewError('element count > 10000', sendResponseCallback);
        }
    }

    function setTimerJob(timeToSuspend) {

        //slightly randomise suspension timer to spread the cpu load when multiple tabs all suspend at once
        if (timeToSuspend > (1000 * 60)) {
            timeToSuspend = timeToSuspend + parseInt((Math.random() * 1000 * 60), 10);
        }

        suspendDateTime = new Date((new Date()).getTime() + timeToSuspend);

        return setTimeout(function () {
            //if inputState is set, perform value checks of edited elements
            if (inputState) {
				formInputChecker();
            }
            //request suspension
            if (!inputState && !tempWhitelist) {
                chrome.runtime.sendMessage({ action: 'suspendTab' });
            }
        }, timeToSuspend);
    }

    function formInputListener(event) {
        if (!inputState && !tempWhitelist) {
            if (event.keyCode >= 48 && event.keyCode <= 90 && event.target.tagName) {
                if (event.target.tagName.toUpperCase() === 'INPUT' ||
                        event.target.tagName.toUpperCase() === 'TEXTAREA' ||
                        event.target.tagName.toUpperCase() === 'FORM' ||
                        event.target.isContentEditable === true) {
                    inputState = true;
                    chrome.runtime.sendMessage(buildReportTabStatePayload());
                    editedInputControls.push(event.target);
                }
            }
        }
    }
    
    function formInputChecker() {
        var newEditedInputControls = [];
        for (var el of editedInputControls) {
            if (isElementInBody(el) === true) {
                //checks for `value` of `<input>` elements for any non-empty value
                if (el.tagName.toUpperCase() == "INPUT" && !el.tagName.getAttribute("value")) {
                    newEditedInputControls.push(el);                    
                //checks for `textContent` of other types of elements for any non-empty value
                } else if ((el.tagName.toUpperCase() == "TEXTAREA" ||
                            el.tagName.isContentEditable === true) && 
                           !el.textContent) {
                    newEditedInputControls.push(el);
                }
            }
        }
        //replaces old list with updated one
        editedInputControls = newEditedInputControls;
        
        //updates status if all edited elements don't have values.
        if (editedInputControls.length == 0) {
            inputState = false;
            var tabState = buildTabStateObject();
            chrome.runtime.sendMessage(tabState);
        }
    }

    function isElementInBody(el) {
        while (el) {
            if (el.tagName === "BODY")
                return true;
            el = el.parentElement;
        }
        return false;
    }

    //listen for background events
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

        if (request.hasOwnProperty('action')) {
            //listen for preview request
            if (request.action === 'generatePreview') {
                generatePreviewImg(request.screenCapture, request.forceScreenCapture, sendResponse);
                shouldSuspendTab = true;
                return true;
            //listen for suspend request
            } else if (request.action === 'confirmTabSuspend' && request.suspendedUrl) {
                sendResponse();
                suspendTab(request.suspendedUrl);
                return false;
            }
        }

        if (request.hasOwnProperty('ignoreForms')) {
            window.removeEventListener('keydown', formInputListener);
            if (request.ignoreForms) {
                window.addEventListener('keydown', formInputListener);
            }
            inputState = inputState && request.ignoreForms;
        }
        if (request.hasOwnProperty('tempWhitelist')) {
            if (inputState && !request.tempWhitelist) {
                inputState = false;
            }
            tempWhitelist = request.tempWhitelist;
        }
        if (request.hasOwnProperty('scrollPos')) {
            if (request.scrollPos !== '' && request.scrollPos !== '0') {
                document.body.scrollTop = request.scrollPos;
            }
        }
        if (request.hasOwnProperty('suspendTime')) {
            clearTimeout(timerJob);
            shouldSuspendTab = false;
            var suspendTime = Number(request.suspendTime);
            if (!isNaN(suspendTime) && suspendTime > 0) {
                timerJob = setTimerJob(request.suspendTime * (1000 * 60));
            } else {
                suspendDateTime = false;
            }
        }
        sendResponse(buildReportTabStatePayload());
        return false;
    });

    function buildReportTabStatePayload(state) {
        return {
            action: 'reportTabState',
            status: state || (inputState ? 'formInput' : (tempWhitelist ? 'tempWhitelist' : 'normal')),
            scrollPos: document.body.scrollTop,
            timerUp: suspendDateTime ? suspendDateTime + '' : '-'
        };
    }
}());
