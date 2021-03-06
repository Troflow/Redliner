// findIndex polyfill
if (!Array.prototype.findIndex) {
    Object.defineProperty(Array.prototype, 'findIndex', {
        value: function (predicate) {
            'use strict';
            if (this === null) {
                throw new TypeError('Array.prototype.findIndex called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;

            for (var i = 0; i < length; i++) {
                value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return i;
                }
            }
            return -1;
        },
        enumerable: false,
        configurable: false,
        writable: false
    });
}

(function (factory, window) {
    // define an AMD module that relies on 'leaflet'
    if (typeof define === 'function' && define.amd) {
        define(['leaflet'], factory);

        // define a Common JS module that relies on 'leaflet'
    } else if (typeof exports === 'object') {
        module.exports = factory(require('leaflet'));
    }

    // attach your plugin to the global 'L' variable
    if (typeof window !== 'undefined' && window.L) {
        window.L.Redliner = factory(L);
    }
}(function (L) {
    var Redliner = {
        options: {
        },

        getMessage: function () {
            return 'Map Comment Tool';
        },

        addTo: function (map) {
            var self = this;
            self.ownMap = map;

            // Add root object as 'root' for all components
            self.Comments.root = self;
            self.Util.root = self;
            self.Tools.root = self;
            self.Events.root = self;
            self.GUI.root = self;

            self.Events.initializeListeners();

            self.currentMode = 'map';

            self.mergeCanvas = document.createElement('canvas');
            self._map = map;

            map.Redliner = Redliner;
        },

        startDrawingMode: function (comment, options) {
            var self = this;
            // spawn a drawing canvas
            self.drawingCanvas = L.canvas({
                padding: 0
            });
            self.drawingCanvas.addTo(self.ownMap);

            // set canvas class
            self.drawingCanvas._container.className += " drawing-canvas";

            // set mode to "drawing"
            self.currentMode = 'drawing';

            // Remove all comment layer groups from map
            self.Comments.list.forEach(function (_comment) {
                if (!options || (_comment.id != comment.id)) {
                    _comment.removeFrom(self.ownMap);
                }
            });

            self.Comments.editingComment = comment;

            // turn on all drawing tools
            if (options) {
                self.Tools.on(options);
            } else {
                self.Tools.on();
            }
        },

        stopDrawingMode: function () {
            var self = this;

            // turn off all drawing tools
            self.Tools.off();

            self.Comments.editingComment = '';

            // Make sure all comment layers are not visible on map
            self.Comments.list.forEach(function (comment) {
                comment.removeFrom(map);
            });

            self.drawingCanvas.removeFrom(map);
            delete self.drawingCanvas;
        },

        startNewComment: function () {
            var self = this;

            // create new comment
            var newComment = self.Comments.newComment();

            // trigger drawing mode
            self.startDrawingMode(newComment);

            return newComment;
        },


        saveDrawing: function (comment, options) {
            var self = this;
            var isNew = !comment.saveState;

            // prompt for title saving...
            if (!comment.saveState) {
                comment.name = prompt("Please name your note", "Note") || "Untitled Note";
            }

            if (options && options.textSave) {
                // saving text, so special case
            } else {
                // SAVING LOGIC
                var context = self.drawingCanvas._ctx;
                var canvas = context.canvas;

                var canvasDrawing = canvas.toDataURL("data:image/png");

                var imageBoundsXY = self.drawingCanvas._bounds;
                var imageBoundsMinCoord = self.ownMap.layerPointToLatLng(imageBoundsXY.min);
                var imageBoundsMaxCoord = self.ownMap.layerPointToLatLng(imageBoundsXY.max);
                var imageBounds = [
                  [imageBoundsMinCoord.lat, imageBoundsMinCoord.lng],
                  [imageBoundsMaxCoord.lat, imageBoundsMaxCoord.lng]
                ];
                var drawing = L.imageOverlay(canvasDrawing, imageBounds);
                drawing.layerType = 'drawing';
                var oldDrawing;
                if (comment.saveState) {
                    comment.getLayers().forEach(function (layer) {
                        if (layer.layerType == 'drawing') {
                            comment.removeLayer(layer);
                            oldDrawing = layer;
                        }
                    });
                }

                comment.addLayer(drawing);

                if (oldDrawing) {
                    var mergeCanvas = self.mergeCanvas;
                    document.body.appendChild(canvas);
                    var mergeContext = mergeCanvas.getContext('2d');

                    var newX_left = self.ownMap.latLngToLayerPoint(self.ownMap.getBounds()._southWest).x;
                    var newX_right = self.ownMap.latLngToLayerPoint(self.ownMap.getBounds()._northEast).x;
                    var newY_top = self.ownMap.latLngToLayerPoint(self.ownMap.getBounds()._northEast).y;
                    var newY_bottom = self.ownMap.latLngToLayerPoint(self.ownMap.getBounds()._southWest).y;
                    var oldX_left = self.ownMap.latLngToLayerPoint(oldDrawing._bounds._southWest).x;
                    var oldX_right = self.ownMap.latLngToLayerPoint(oldDrawing._bounds._northEast).x;
                    var oldY_top = self.ownMap.latLngToLayerPoint(oldDrawing._bounds._northEast).y;
                    var oldY_bottom = self.ownMap.latLngToLayerPoint(oldDrawing._bounds._southWest).y;

                    var leftMost = Math.min(newX_left, oldX_left);
                    var rightMost = Math.max(newX_right, oldX_right);
                    var topMost = Math.min(newY_top, oldY_top);
                    var bottomMost = Math.max(newY_bottom, oldY_bottom);

                    mergeCanvas.height = bottomMost - topMost;
                    mergeCanvas.width = rightMost - leftMost;

                    var oldImageToCanvas = new Image();
                    var newImageToCanvas = new Image();
                    var mergedDrawingLayer;
                    var newSouthWest = self.ownMap.layerPointToLatLng([leftMost, bottomMost]);
                    var newNorthEast = self.ownMap.layerPointToLatLng([rightMost, topMost]);

                    oldImageToCanvas.onload = function () {
                        mergeContext.drawImage(oldImageToCanvas, oldX_left - leftMost, oldY_top - topMost, oldX_right - oldX_left, oldY_bottom - oldY_top);
                        newImageToCanvas.src = canvasDrawing;
                    };
                    newImageToCanvas.onload = function () {
                        // to make the eraser tool work...
                        mergeContext.globalCompositeOperation = "destination-out";
                        mergeContext.fillStyle = "white";
                        mergeContext.fillRect(newX_left - leftMost, newY_top - topMost, newX_right - newX_left, newY_bottom - newY_top);

                        mergeContext.globalCompositeOperation = "source-over";
                        mergeContext.drawImage(newImageToCanvas, newX_left - leftMost, newY_top - topMost, newX_right - newX_left, newY_bottom - newY_top);
                        var mergedDrawing = mergeCanvas.toDataURL("data:image/png");
                        comment.removeLayer(drawing);
                        mergedDrawingLayer = L.imageOverlay(mergedDrawing, [newSouthWest, newNorthEast]);
                        comment.addLayer(mergedDrawingLayer);
                        mergedDrawingLayer.layerType = 'drawing';

                        if (options && !options.textSave) {
                            var event = document.createEvent("CustomEvent");
                            var sendComment = {
                                id: comment.id,
                                name: comment.name,
                                center: comment.coords,
                                drawing: {
                                    dataUrl: mergedDrawing,
                                    bounds: {
                                        _southWest: newSouthWest,
                                        _northEast: newNorthEast
                                    },
                                },
                                initialZoom: comment.initialZoom,
                                textAnnotations: []
                            }

                            if (comment.textLayerGroup) {
                                comment.textLayerGroup.getLayers().forEach(function (layer) {
                                    var textNote = {
                                        id: layer.textId,
                                        textVal: layer.textVal,
                                        latlng: layer._latlng
                                    };

                                    sendComment.textAnnotations.push(textNote);
                                });
                            }

                            event.initCustomEvent("comment-edit-end", true, false, sendComment);
                            // Dispatch the event.
                            self.ownMap._container.dispatchEvent(event);
                        }

                    };

                    oldImageToCanvas.src = oldDrawing._url;

                }
            }

            self.stopDrawingMode();

            comment.saveState = true;

            // something might be wrong in here
            if (options && options.textSave) {
                var image;
                comment.getLayers().forEach(function (layer) {
                    if (layer.layerType == 'drawing') {
                        image = layer;
                    }
                });
                self.editComment(comment, image);
            }

            if (isNew) {
                var event = document.createEvent("CustomEvent");
                event.initCustomEvent("new-comment-saved", true, false, {
                    name: comment.name,
                    id: comment.id,
                    center: comment.coords,
                    drawing: {
                        dataUrl: canvasDrawing,
                        bounds: self.ownMap.getBounds()
                    },
                    initialZoom: comment.initialZoom
                });
                // Dispatch the event.
                self.ownMap._container.dispatchEvent(event);

            }

            return comment;
        },

        editComment: function (comment, image, options) {
            var self = this;

            // trigger drawing mode
            if (options) {
                self.startDrawingMode(comment, options);
            } else {
                self.startDrawingMode(comment);
            }
            self.Comments.editingComment = comment;
            var canvas = self.drawingCanvas._container;
            var context = canvas.getContext('2d');
            var canvasTransformArray;

            canvasTransformArray = canvas.style.transform.split(/,|\(|\)|px| /);

            if (image) {
                console.log(image);

                var imageObj = new Image();
                image.addTo(self.ownMap); // needed for image width and height...
                // remember to remove the image after it is no longer needed (i.e. in imageObj.onload)
                // it might be necessary to trigger the rest of this block AFTER the image layer is added by listening for the 'add' event
                // for now this seems to be working, so I will leave it like this

                var newWidth = image._image.width // * self.ownMap.getZoomScale(self.ownMap.getZoom(), comment.initialZoom); - this isn't needed apparently!
                var newHeight = image._image.height //* self.ownMap.getZoomScale(self.ownMap.getZoom(), comment.initialZoom); - image height and width are adjusted by leaflet when changing zoom levels

                imageObj.onload = function () {
                    context.drawImage(imageObj, image._image._leaflet_pos.x, image._image._leaflet_pos.y, newWidth, newHeight);
                    image.removeFrom(self.ownMap);
                };

                imageObj.src = image._image.src;
            }

            var event = document.createEvent("CustomEvent");
            var sendComment = {
                id: comment.id,
                name: comment.name
            }
            event.initCustomEvent("comment-edit-start", true, false, sendComment);
            // Dispatch the event.
            self.ownMap._container.dispatchEvent(event);

            self.Comments.mostRecentUsedComment = comment;

            return comment;
        },

    };

    Redliner.Comments = {
        list: [],
        editingComment: '',

        saved: function (comment) {
            var self = this;
            return comment.saveState;
        },

        newComment: function (loadedComment, index) {
            var self = this;
            var comment = L.layerGroup();
            comment.name = "Untitled Note";
            comment.textLayerGroup = L.layerGroup();
            comment.coords = self.root.ownMap.getCenter();
            comment.initialZoom = self.root.ownMap.getZoom();

            if (loadedComment) {
                //console.log(loadedComment);

                // prep comment with all that tasty info
                comment.saveState = true;
                //console.log("LOADED COMMENT ID", loadedComment.id)
                comment.id = loadedComment.id;
                comment.name = loadedComment.name;
                comment.initialZoom = loadedComment.initialZoom;
                comment.coords = L.latLng(loadedComment.center);

                // load sketch
                //console.log(loadedComment.drawing.bounds);
                var newImage = L.imageOverlay(loadedComment.drawing.dataUrl, [loadedComment.drawing.bounds._northEast, loadedComment.drawing.bounds._southWest]);

                newImage.addTo(comment);
                newImage.layerType = 'drawing';

                // load all text annotations
                // if (loadedComment.textAnnotations) {
                if (false) {
                        loadedComment.textAnnotations.forEach(function (layer) {
                        var myIcon = L.divIcon({
                            className: 'text-comment-div',
                            html: '<textarea id="' + layer.textId + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" class="text-comment-input" rows="6" cols="30" maxlength="130"></textarea>'
                        });

                        marker = L.marker(layer.latlng, {
                            icon: myIcon
                        });
                        marker.textId = layer.textId;
                        marker.addTo(comment.textLayerGroup);
                        marker.layerType = 'textAreaMarker';

                        var img = new Image();

                        img.onload = function () {
                            // give the marker all its listeners
                            self.root.Tools.text.placeText({
                                marker: marker,
                                img: img,
                                textId: layer.textId,
                                val: layer.textVal,
                                comment: comment,
                            }, self.root);
                        };
                        img.src = layer.textDrawing.dataUrl;

                    });
                }
                comment.addTo(self.root.ownMap);

            } else {
                comment.id = self.root.Util.generateGUID();
                comment.saveState = false;
                self.editingComment = comment;
            }

            if (index != null) {
                //console.log(self.list[index]);
                self.list[index].removeFrom(self.root.ownMap);
                self.list[index] = comment;
                //console.log(self.list[index]);
                // updating a comment
            } else {
                self.list.push(comment);
                var event = document.createEvent("CustomEvent");
                event.initCustomEvent("new-comment-created", true, false, { detail: {} });
                // Dispatch the event.
                self.root.ownMap._container.dispatchEvent(event);

            }

            self.root.Comments.mostRecentUsedComment = comment;
            return comment;
        }
    };

    Redliner.Util = {
        generateGUID: function () {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
            }
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        },

        getMousePos: function (e) {
            var self = this;

            pos = self.root.ownMap.mouseEventToLayerPoint(e);
            return {
                x: pos.x,
                y: pos.y,
            };
        },

        cropImageFromCanvas: function (ctx, canvas) {
            var w = canvas.width,
            h = canvas.height,
            pix = { x: [], y: [] },
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height),
            x, y, index;

            for (y = 0; y < h; y++) {
                for (x = 0; x < w; x++) {
                    index = (y * w + x) * 4;
                    if (imageData.data[index + 3] > 0) {
                        pix.x.push(x);
                        pix.y.push(y);
                    }
                }
            }
            pix.x.sort(function (a, b) {
                return a - b;
            });
            pix.y.sort(function (a, b) {
                return a - b;
            });
            var n = pix.x.length - 1;

            w = pix.x[n] - pix.x[0] + 5;
            h = pix.y[n] - pix.y[0] + 5;
            var cut = ctx.getImageData(pix.x[0] - 3, pix.y[0] - 3, w, h);

            canvas.width = w;
            canvas.height = h;
            ctx.putImageData(cut, 0, 0);

            var image = canvas.toDataURL();
            return image;
        },

    };

    Redliner.Tools = {
        currentTool: '',
        toolList: ['pen', 'eraser', 'text'],
        defaultTool: 'pen',

        on: function (options) {
            var self = this;
            self.pen.root = self.root;
            self.eraser.root = self.root;
            self.text.root = self.root;

            if (!options) {
                self.pen.setListeners();
                self.eraser.setListeners();
                self.text.setListeners();

                // add all text images
                self.root.Comments.editingComment.getLayers().forEach(function (layer) {
                    if (layer.layerType == 'textDrawing') {
                        layer.addTo(self.root.ownMap);
                    }
                });
            } else {
                var canvas = self.root.drawingCanvas._container;
                var clickCanvasEndText = function (e) {
                    options.textAreaMarker.removeFrom(self.root.ownMap);
                    canvas.removeEventListener('click', clickCanvasEndText, false);
                    self.root.Tools.on();
                    self.root.Comments.editingComment.addTo(self.root.ownMap);
                    // save everything (with options)
                    self.root.saveDrawing(self.root.Comments.editingComment, { textSave: true });
                };
                canvas.addEventListener('click', clickCanvasEndText, false);
            }

            self.setCurrentTool(self.defaultTool, {
                colour: 'red'
            });
        },

        off: function () {
            var self = this;
            self[self.currentTool].terminate();
            self.currentTool = '';
            // add all text images

            self.root.Comments.editingComment.getLayers().forEach(function (layer) {
                if (layer.layerType == 'textDrawing') {
                    layer.removeFrom(self.root.ownMap);
                }
            });

        },

        setCurrentTool: function (tool, options) {
            var self = this;
            if (self.currentTool) {
                self[self.currentTool].terminate();
            }
            self.currentTool = tool;
            self[self.currentTool].initialize(options);
            // set canvas class
            self.toolList.forEach(function (toolname) {
                self.root.drawingCanvas._container.classList.remove("drawing-canvas-" + toolname);
            });
            self.root.drawingCanvas._container.classList.add("drawing-canvas-" + tool);
            return tool;
        },

        pen: {
            name: 'pen',
            colour: 'red',
            strokeWidth: '',
            stroke: false,
            mouseX: 0,
            mouseY: 0,
            lastX: -1,
            lastY: -1,
            initialize: function (options) {
                var self = this;
                self.colour = options.colour;
                self.root.drawingCanvas._container.classList.add("drawing-canvas-" + self.colour + "-pen");
                self.root.ownMap.getPane('markerPane').style['z-index'] = 300;
            },
            terminate: function () {
                var self = this;
                self.root.drawingCanvas._container.classList.remove("drawing-canvas-" + self.colour + "-pen");
            },
            drawLine: function (ctx, x, y, size) {
                var self = this;
                //operation properties
                ctx.globalCompositeOperation = "source-over";

                // If lastX is not set, set lastX and lastY to the current position
                if (self.lastX == -1) {
                    self.lastX = x;
                    self.lastY = y;
                }

                ctx.strokeStyle = self.colour;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(self.lastX, self.lastY);
                ctx.lineTo(x, y);
                ctx.lineWidth = size;
                ctx.stroke();
                ctx.closePath();
                // Update the last position to reference the current position
                self.lastX = x;
                self.lastY = y;
            },

            // don't have to remove listeners because the canvas gets removed anyways...
            setListeners: function () {
                var self = this;
                var canvas = self.root.drawingCanvas._container;
                var context = canvas.getContext('2d');
                canvas.addEventListener('mousedown', function () {
                    if (self.root.Tools.currentTool == 'pen') {
                        self.stroke = true;
                    }
                });
                canvas.addEventListener('touchstart', function () {
                    if (self.root.Tools.currentTool == 'pen') {
                        self.stroke = true;
                    }
                    //console.log('touch start');
                });

                canvas.addEventListener('mousemove', function (e) {
                    if (self.stroke && self.root.Tools.currentTool == 'pen') {
                        var pos = self.root.Util.getMousePos(e);
                        self.mouseX = pos.x;
                        self.mouseY = pos.y;
                        self.drawLine(context, self.mouseX, self.mouseY, 3);
                    }
                }, false);
                canvas.addEventListener('touchmove', function (e) {
                    if (self.stroke && self.root.Tools.currentTool == 'pen') {
                        var pos = self.root.Util.getMousePos(e);
                        self.mouseX = pos.x;
                        self.mouseY = pos.y;
                        self.drawLine(context, self.mouseX, self.mouseY, 3);
                    }
                    //console.log('touchmove');
                }, false);

                window.addEventListener('mouseup', function (e) {
                    if (self.stroke && self.root.Tools.currentTool == 'pen') {
                        self.stroke = false;
                        // Reset lastX and lastY to -1 to indicate that they are now invalid, since we have lifted the "pen"
                        self.lastX = -1;
                        self.lastY = -1;
                    }
                }, false);
                window.addEventListener('touchend', function (e) {
                    if (self.stroke && self.root.Tools.currentTool == 'pen') {
                        self.stroke = false;
                        // Reset lastX and lastY to -1 to indicate that they are now invalid, since we have lifted the "pen"
                        self.lastX = -1;
                        self.lastY = -1;
                    }
                    //console.log('touch end');
                }, false);
            }
        },

        eraser: {
            name: 'eraser',
            color: '',
            strokeWidth: '',
            stroke: false,
            mouseX: 0,
            mouseY: 0,
            lastX: -1,
            lastY: -1,
            initialize: function () {
                var self = this;
                self.root.ownMap.getPane('markerPane').style['z-index'] = 600;
            },
            terminate: function () {
                var self = this;
                self.root.ownMap.getPane('markerPane').style['z-index'] = 300;
            },
            drawLine: function (ctx, x, y, size) {
                var self = this;
                //operation properties
                ctx.globalCompositeOperation = "destination-out";

                // If lastX is not set, set lastX and lastY to the current position
                if (self.lastX == -1) {
                    self.lastX = x;
                    self.lastY = y;
                }

                r = 250;
                g = 0;
                b = 0;
                a = 255;
                ctx.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + (a / 255) + ")";
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(self.lastX, self.lastY);
                ctx.lineTo(x, y);
                ctx.lineWidth = size;
                ctx.stroke();
                ctx.closePath();
                // Update the last position to reference the current position
                self.lastX = x;
                self.lastY = y;
            },

            // don't have to remove listeners because the canvas gets removed anyways...
            setListeners: function () {
                var self = this;
                var canvas = self.root.drawingCanvas._container;
                var context = canvas.getContext('2d');
                canvas.addEventListener('mousedown', function () {
                    if (self.root.Tools.currentTool == 'eraser') {
                        self.stroke = true;
                    }
                });

                canvas.addEventListener('mousemove', function (e) {
                    if (self.stroke && self.root.Tools.currentTool == 'eraser') {
                        var pos = self.root.Util.getMousePos(e);
                        self.mouseX = pos.x;
                        self.mouseY = pos.y;
                        self.drawLine(context, self.mouseX, self.mouseY, 35);
                    }
                }, false);

                window.addEventListener('mouseup', function (e) {
                    if (self.stroke && self.root.Tools.currentTool == 'eraser') {
                        self.stroke = false;
                        // Reset lastX and lastY to -1 to indicate that they are now invalid, since we have lifted the "pen"
                        self.lastX = -1;
                        self.lastY = -1;
                    }
                }, false);
            }
        },

        text: {
            color: '',
            name: 'text',
            state: 'addMarker',
            initialize: function () {
                var self = this;
                self.root.ownMap.getPane('markerPane').style['z-index'] = 600;
            },
            terminate: function () {
                var self = this;
                self.root.ownMap.getPane('markerPane').style['z-index'] = 300;
            },
            setListeners: function () {
                var self = this;
                var canvas = self.root.drawingCanvas._container;
                var context = canvas.getContext('2d');
                var comment = self.root.Comments.editingComment;
                var imconage;
                var id;
                var textBox;
                var marker;
                comment.getLayers().forEach(function (layer) {
                    if (layer.layerType == 'drawing') {
                        image = layer;
                    }
                });

                var inputRenderText = function (e) {
                    self.renderText(comment, id, textBox.value, marker);
                };

                var clickAddText = function (e) {
                    if (self.root.Tools.currentTool == 'text') {
                        canvas = self.root.drawingCanvas._container;

                        var coords = self.root.ownMap.containerPointToLatLng([e.layerX, e.layerY]);
                        var image;

                        // hide all text annotations ... just for visuals
                        comment.textLayerGroup.getLayers().forEach(function (layer) {
                            layer.removeFrom(self.root.ownMap);
                        });

                        id = self.root.Util.generateGUID();

                        var myIcon = L.divIcon({
                            className: 'text-comment-div',
                            html: '<textarea id="' + id + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" class="text-comment-input" rows="6" cols="30" maxlength="130"></textarea>'
                        });

                        marker = L.marker(coords, {
                            icon: myIcon
                        });
                        marker.textId = id;
                        marker.addTo(comment.textLayerGroup);
                        marker.addTo(self.root.ownMap);
                        marker.layerType = 'textAreaMarker';
                        self.root.saveDrawing(comment);
                        self.root.ownMap.setView(marker._latlng, map.getZoom(), { animate: false });
                        self.root.ownMap.panBy([200, 150], { animate: false });

                        // start editing again
                        // ...

                        comment.getLayers().forEach(function (layer) {
                            if (layer.layerType == 'drawing') {
                                image = layer;
                            }
                        });
                        self.root.editComment(comment, image, { addText: true, textAreaMarker: marker });
                        self.root.Tools.setCurrentTool('text', { listeners: false });
                        textBox = document.getElementById(id);
                        textBox.focus();
                        textBox.addEventListener('input', inputRenderText, false);
                    }
                };

                canvas.addEventListener('click', clickAddText, false);
            },
            renderText: function (comment, textId, val, marker) {
                var self = this;
                var textBox = document.getElementById(textId);
                var boundingRect = textBox.getBoundingClientRect();
                //remove old drawing
                comment.getLayers().forEach(function (layer) {
                    if (layer.layerType == 'textDrawing' && layer.textId == textId) {
                        comment.removeLayer(layer);
                        layer.removeFrom(self.root.ownMap);
                    }
                });

                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                //hardcoded for now
                canvas.height = 1000;
                canvas.width = 1000;
                var lineHeight = 25;
                var colWidth = 18;
                ctx.font = "30px monospace";
                var col = 0;
                var row = 0;

                // parsing every character, this is going to turn into a beast one day
                val.split('').forEach(function (splitChar) {
                    ctx.fillText(splitChar, col * colWidth, (row + 1) * lineHeight); // figure out the relationship between this offset and the font size....
                    col++;
                    if ((col == 30) || splitChar == '\n') {
                        col = 0;
                        row++;
                    }
                });

                var img = new Image();

                img.onload = function () {
                    self.placeText({
                        marker: marker,
                        img: img,
                        textId: textId,
                        val: val,
                        comment: comment,
                    });
                };

                img.src = self.root.Util.cropImageFromCanvas(ctx, canvas);
            },

            placeText: function (args, root) {
                var self = this; // I should get this tattooed on my forehead.

                if (root) {
                    self.root = root;
                }

                var marker = args.marker;
                var img = args.img;
                var textId = args.textId;
                var val = args.val;
                var comment = args.comment;

                var markerToPoint = self.root.ownMap.latLngToLayerPoint(marker._latlng);
                var southWest = self.root.ownMap.layerPointToLatLng([markerToPoint.x + img.width, markerToPoint.y + img.height]);
                var northEast = marker._latlng;
                var newTextImageOverlay = L.imageOverlay(img.src, [southWest, northEast], { interactive: true, pane: 'markerPane' });
                newTextImageOverlay.layerType = 'textDrawing';
                newTextImageOverlay.textId = textId;

                marker.bounds = {
                    northEast: northEast,
                    southWest: southWest,
                };
                marker.dataUrl = img.src;
                marker.textVal = val;
                marker.textZoomLevel = map.getZoom();

                // eraser listeners
                newTextImageOverlay.on('mouseover', function () {
                    if (self.root.Tools.currentTool == 'eraser') {
                        L.DomUtil.addClass(newTextImageOverlay._image, 'text-hover-erase');
                    }
                });
                newTextImageOverlay.on('mouseout', function () {
                    if (self.root.Tools.currentTool == 'eraser') {
                        L.DomUtil.removeClass(newTextImageOverlay._image, 'text-hover-erase');
                    }
                });
                newTextImageOverlay.on('click', function () {
                    if (self.root.Tools.currentTool == 'eraser') {
                        // this thing is a mess
                        comment.removeLayer(newTextImageOverlay);
                        comment.textLayerGroup.removeLayer(marker);
                        newTextImageOverlay.removeFrom(self.root.ownMap);
                    }
                });

                // text tool listeners (for editing)
                newTextImageOverlay.on('mouseover', function () {
                    if (self.root.Tools.currentTool == 'text') {
                        L.DomUtil.addClass(newTextImageOverlay._image, 'text-hover-edit');
                    }
                });
                newTextImageOverlay.on('mouseout', function () {
                    if (self.root.Tools.currentTool == 'text') {
                        L.DomUtil.removeClass(newTextImageOverlay._image, 'text-hover-edit');
                    }
                });
                newTextImageOverlay.on('click', function () {
                    if (self.root.Tools.currentTool == 'text') {
                        L.DomUtil.removeClass(newTextImageOverlay._image, 'text-hover-edit');

                        self.root.saveDrawing(comment);
                        self.root.ownMap.setView(marker._latlng, marker.textZoomLevel, { animate: false });
                        self.root.ownMap.panBy([200, 150], { animate: false });

                        newTextImageOverlay.removeFrom(self.root.ownMap);

                        comment.textLayerGroup.getLayers().forEach(function (layer) {
                            if (layer.layerType == 'textAreaMarker' && layer.textId == textId) {
                                layer.addTo(self.root.ownMap);
                                var inputBox = document.getElementById(textId);
                                inputBox.value = layer.textVal;
                                inputBox.focus();

                                var inputRenderText = function (e) {
                                    self.renderText(comment, textId, inputBox.value, layer);
                                };

                                var image;
                                comment.getLayers().forEach(function (layer) {
                                    if (layer.layerType == 'drawing') {
                                        image = layer;
                                    }
                                });

                                self.root.editComment(comment, image, { addText: true, textAreaMarker: marker });
                                self.root.Tools.setCurrentTool('text', { listeners: false });

                                inputBox.addEventListener('input', inputRenderText, false);
                            }
                        });
                    }
                });

                comment.addLayer(newTextImageOverlay);
                newTextImageOverlay.removeFrom(self.root.ownMap);
            }
        }
    };
    Redliner.Events = {
        initializeListeners: function () {
            var self = this;

            var fireUpdateCommentListViewEvent = function () {
                var event = document.createEvent("CustomEvent");
                event.initCustomEvent("comment-list-refresh", true, false, { detail: {} });
                // Dispatch the event.
                window.dispatchEvent(event);

            }

            var fireShowToolsEvent = function () {
                var event = document.createEvent("CustomEvent");
                event.initCustomEvent("drawing-tools-show", true, false, { detail: {} });
                // Dispatch the event.
                window.dispatchEvent(event);
            }
            var fireHideToolsEvent = function () {
                var event = document.createEvent("CustomEvent");
                event.initCustomEvent("drawing-tools-hide", true, false, { detail: {} });
                // Dispatch the event.
                window.dispatchEvent(event);
            }

            var fireEnableEditEvent = function (comment) {
                var event = document.createEvent("CustomEvent");
                event.initCustomEvent('enable-edit', true, false, comment);
                // Dispatch the event.
                window.dispatchEvent(event);
            }

            var fireDisableEditEvent = function (comment) {
                var event = document.createEvent("CustomEvent");
                event.initCustomEvent('disable-edit', true, false, comment);
                // Dispatch the event.
                window.dispatchEvent(event);
            }

            self.root.ownMap._container.addEventListener('new-comment-created', function (e) {
                //console.log('new comment created');
                fireUpdateCommentListViewEvent();
            }, false);
            self.root.ownMap._container.addEventListener('new-comment-saved', function (e) {
                //console.log('new comment saved');
                fireUpdateCommentListViewEvent();
            }, false);
            self.root.ownMap._container.addEventListener('comment-edit-start', function (e) {
                //console.log('started editing a comment');
                fireUpdateCommentListViewEvent();
                fireShowToolsEvent();
                var comment = e.detail;
                fireDisableEditEvent(comment);
            }, false);
            self.root.ownMap._container.addEventListener('comment-edit-end', function (e) {
                //console.log('finished editing a comment');
                fireUpdateCommentListViewEvent();
                fireHideToolsEvent();
                var comment = e.detail;
                fireEnableEditEvent(comment);
            }, false);

            // listen for events emitted by Network module
            window.addEventListener('remote-new-comment-created', function (e) {
                //console.log('new comment created by another client');
            }, false);

            window.addEventListener('remote-new-comment-saved', function (e) {
                var comment = e.detail.comment;
                //console.log('new comment saved by another client');
                // load comment

                self.root.Comments.newComment(comment).removeFrom(self.root.ownMap);
            }, false);

            window.addEventListener('remote-comment-edit-start', function (e) {

                self.root.Comments.list.forEach(function (comment) {
                    if (comment.id == e.detail.id) {
                        fireDisableEditEvent(comment);
                    }
                });
            }, false);

            window.addEventListener('remote-comment-edit-end', function (e) {
                var receivedComment = e.detail;
                console.log(receivedComment, "RECEIVED COMMENT");

                self.root.Comments.list.forEach(function (comment, index) {
                    if (comment.id == receivedComment.id) {

                        self.root.Comments.newComment(receivedComment, index).removeFrom(self.root.ownMap);

                        /*
                        // update comment with new drawing by dropping old drawing layer and making a new one.
                        // drop all text annotations and text images

                        comment.getLayers().forEach(function (layer) {
                            if (layer.layerType == "drawing" || layer.layerType == "textDrawing") {
                                comment.removeLayer(layer);
                                layer.removeFrom(map);
                            }
                        });
                        // remove all text markers
                        if (comment.textLayerGroup) {
                            comment.textLayerGroup.getLayers().forEach(function (layer) {
                                comment.textLayerGroup.removeLayer(layer);
                                layer.removeFrom(map);
                            });
                        }

                        var drawing = L.imageOverlay(receivedComment.drawing, receivedComment.bounds);
                        drawing.layerType = 'drawing';
                        comment.addLayer(drawing);

                        console.log(receivedComment);

                        receivedComment.textAnnotations.forEach(function (annotation) {
                            var myIcon = L.divIcon({
                                className: 'text-comment-div',
                                html: '<textarea id="' + annotation.id + '" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" class="text-comment-input" rows="6" cols="30" maxlength="130"></textarea>'
                            });
                            var marker = L.marker(annotation.latlng, {
                                icon: myIcon
                            });
                            marker.textId = annotation.id;
                            marker.addTo(comment.textLayerGroup);
                            marker.addTo(self.root.ownMap);
                            marker.layerType = 'textAreaMarker';

                        });
                        */
                        fireEnableEditEvent(comment);
                        fireUpdateCommentListViewEvent();
                    }
                });
            }, false);
            // etc ....

            //console.log('listeners set');
        }
    };

    Redliner.GUI = {
        // using leaflet.panel-manager

        loadPanels: function () {
            var self = this;
            var guiSpecification = {}
            guiSpecification.panels = [];

            // Tool panel (3 colours of pens, eraser, and text tool)
            var oldMouseStyle;

            var toolPanel = {
                type: "button-list",
                position: "bottom",
                toggleHide: "button",
                title: "Drawing Tools",
                panelName: "redliner-drawing-tools",
                toggleOnCallback: function () {
                    self.root.startNewComment();
                    self.root.ownMap.dragging.disable();
                    self.root.ownMap.touchZoom.disable();
                    self.root.ownMap.doubleClickZoom.disable();
                    self.root.ownMap.scrollWheelZoom.disable();
                    self.root.ownMap.boxZoom.disable();
                    self.root.ownMap.keyboard.disable();
                    if (self.root.ownMap.tap) {
                        self.root.ownMap.tap.disable();
                    }
                    oldMouseStyle = document.getElementById('map').style.cursor;
                    document.getElementById('map').style.cursor = 'default';
                },
                toggleOffCallback: function () {
                    self.root.saveDrawing(self.root.Comments.mostRecentUsedComment, { closeSave: true });
                    self.root.ownMap.dragging.enable();
                    self.root.ownMap.touchZoom.enable();
                    self.root.ownMap.doubleClickZoom.enable();
                    self.root.ownMap.scrollWheelZoom.enable();
                    self.root.ownMap.boxZoom.enable();
                    self.root.ownMap.keyboard.enable();
                    if (self.root.ownMap.tap) {
                        self.root.ownMap.tap.enable();
                    }
                    document.getElementById('map').style.cursor = oldMouseStyle;
                },
                buttons: [
                    {
                        name: "red pen",
                        icon: "red-pen",
                        callback: function () {
                            self.root.Tools.setCurrentTool('pen', {
                                colour: 'red'
                            });
                        }
                    },
                    {
                        name: "black pen",
                        icon: "black-pen",
                        callback: function () {
                            self.root.Tools.setCurrentTool('pen', {
                                colour: 'black'
                            });
                        }
                    },
                    {
                        name: "yellow pen",
                        icon: "yellow-pen",
                        callback: function () {
                            self.root.Tools.setCurrentTool('pen', {
                                colour: 'yellow'
                            });
                        }
                    },
                    {
                        name: "eraser",
                        icon: "eraser",
                        callback: function () {
                            self.root.Tools.setCurrentTool('eraser');
                        }
                    },
                    {
                        name: "text",
                        icon: "text",
                        callback: function () {
                            self.root.Tools.setCurrentTool('text');
                        }
                    }
                ]
            }

            guiSpecification.panels.push(toolPanel);

            var commentPanel = {
                type: "document-list",
                position: "bottom",
                responsiveRules: function (map) {
                    var mapSize = map.getSize();
                    if (mapSize.x >= mapSize.y) {
                        var rules = {
                            position: "bottom",
                        }
                        return rules;
                    } else if (mapSize.y > mapSize.x) {
                        var rules = {
                            position: "top",
                        }
                        return rules;
                    }
                },
                title: "Comments",
                toggleHide: true,
                eventName: "comment-list-refresh",
                panelName: "redliner-comment-list",
                documentSource: self.root.Comments.list,
                documentActions: [
                	{
                	    displayName: "View",
                	    name: "view",
                	    action: function (comment) {
                	        //console.log("view comment");
                	        self.root.Comments.list.forEach(function (list_comment) {
                	            list_comment.removeFrom(self.root.ownMap);
                	        });

                	        comment.addTo(self.root.ownMap);
                	        self.root.ownMap.setView(comment.coords, comment.initialZoom);
                	    }
                	},
                    {
                        displayName: "Edit",
                        name: "edit",
                        action: function (comment) {
                            //console.log("edit comment");

                            self.root.ownMap.dragging.disable();
                            self.root.ownMap.touchZoom.disable();
                            self.root.ownMap.doubleClickZoom.disable();
                            self.root.ownMap.scrollWheelZoom.disable();
                            self.root.ownMap.boxZoom.disable();
                            self.root.ownMap.keyboard.disable();
                            if (self.root.ownMap.tap) {
                                self.root.ownMap.tap.disable();
                            }
                            oldMouseStyle = document.getElementById('map').style.cursor;
                            document.getElementById('map').style.cursor = 'default';

                            var image;

                            self.root.Comments.list.forEach(function (list_comment) {
                                list_comment.removeFrom(self.root.ownMap);
                            });

                            comment.getLayers().forEach(function (layer) {
                                if (layer.layerType == "drawing") {
                                    image = layer;
                                }
                            });

                            var event1 = document.createEvent("CustomEvent");
                            event1.initCustomEvent("show-redliner-drawing-tools", true, false, { detail: {} });
                            var event2 = document.createEvent("CustomEvent");
                            event2.initCustomEvent("hide-redliner-comment-list", true, false, { detail: {} });

                            // Dispatch the event.
                            window.dispatchEvent(event1);
                            window.dispatchEvent(event2);

                            self.root.editComment(comment, image);

                        }
                    },
                    {
                        displayName: "Delete",
                        name: "delete",
                        action: function (document) {
                            console.log("delete comment");
                        }
                    }
                ]
            }
            guiSpecification.panels.push(commentPanel);

            return guiSpecification;
        }

    };

    // return your plugin when you are done
    return Redliner;
}, window));
