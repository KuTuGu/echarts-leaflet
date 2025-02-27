/**
 * generate leaflet coord system
 * @param {object}   echarts api object
 * @param {object}   L       leaflet
 *
 * @return {function} LeafletCoordSys
 */
function createLeafletCoordSystem(echarts, L) {
  var util = echarts.util,
      graphic = echarts.graphic,
      matrix = echarts.matrix;

  var CustomOverlay = L.Layer.extend({
    initialize: function initialize(container) {
      this._container = container;
    },

    onAdd: function onAdd(map) {
      var pane = map.getPane(this.options.pane);
      pane.appendChild(this._container);

      // Calculate initial position of container with
      // `L.Map.latLngToLayerPoint()`, `getPixelOrigin()
      // and/or `getPixelBounds()`

      // L.DomUtil.setPosition(this._container, point);

      // Add and position children elements if needed

      // map.on('zoomend viewreset', this._update, this);
    },

    onRemove: function onRemove(map) {
      L.DomUtil.remove(this._container);
      // map.off('zoomend viewreset', this._update, this);
    },

    _update: function _update() {
      // Recalculate position of container
      // L.DomUtil.setPosition(this._container, point);
      // Add/remove/reposition children elements if needed
    }
  });

  /**
   * constructor for Leaflet CoordSys
   * @param {L.map} map
   * @param {Object} api
   */
  function LeafletCoordSys(map, api) {
    this._map = map;
    this.dimensions = ['lng', 'lat'];
    this._mapOffset = [0, 0];
    this._api = api;
    this._projection = L.Projection.Mercator;
  }

  LeafletCoordSys.dimensions = LeafletCoordSys.prototype.dimensions = ['lng', 'lat'];

  LeafletCoordSys.prototype.setZoom = function (zoom) {
    this._zoom = zoom;
  };

  LeafletCoordSys.prototype.setCenter = function (center) {
    this._center = this._projection.project(new L.LatLng(center[1], center[0]));
  };

  LeafletCoordSys.prototype.setMapOffset = function (mapOffset) {
    this._mapOffset = mapOffset;
  };

  LeafletCoordSys.prototype.getLeaflet = function () {
    return this._map;
  };

  LeafletCoordSys.prototype.getViewRect = function () {
    var api = this._api;
    return new graphic.BoundingRect(0, 0, api.getWidth(), api.getHeight());
  };

  LeafletCoordSys.prototype.getRoamTransform = function () {
    return matrix.create();
  };

  LeafletCoordSys.prototype.dataToPoint = function (data) {
    var point = new L.LatLng(data[1], data[0]);
    var px = this._map.latLngToLayerPoint(point);
    var mapOffset = this._mapOffset;
    return [px.x - mapOffset[0], px.y - mapOffset[1]];
  };

  LeafletCoordSys.prototype.pointToData = function (pt) {
    var mapOffset = this._mapOffset;
    var coord = this._map.layerPointToLatLng({
      x: pt[0] + mapOffset[0],
      y: pt[1] + mapOffset[1]
    });
    return [coord.lng, coord.lat];
  };

  LeafletCoordSys.prototype.convertToPixel = util.curry(doConvert, 'dataToPoint');

  LeafletCoordSys.prototype.convertFromPixel = util.curry(doConvert, 'pointToData');

  LeafletCoordSys.create = function (ecModel, api) {
    var leafletCoordSys = void 0;
    var leafletList = [];
    var root = api.getDom();

    // TODO Dispose
    ecModel.eachComponent('leaflet', function (leafletModel) {
      var viewportRoot = api.getZr().painter.getViewportRoot();
      if (typeof L === 'undefined') {
        throw new Error('Leaflet api is not loaded');
      }
      if (leafletCoordSys) {
        throw new Error('Only one leaflet component can exist');
      }
      if (!leafletModel.__map) {
        // Not support IE8
        var mapRoot = root.querySelector('.ec-extension-leaflet');
        if (mapRoot) {
          // Reset viewport left and top, which will be changed
          // in moving handler in LeafletView
          viewportRoot.style.left = '0px';
          viewportRoot.style.top = '0px';
          root.removeChild(mapRoot);
        }
        mapRoot = document.createElement('div');
        mapRoot.style.cssText = 'width:100%;height:100%';
        // Not support IE8
        mapRoot.classList.add('ec-extension-leaflet');
        root.appendChild(mapRoot);
        var _map = leafletModel.__map = L.map(mapRoot, leafletModel.get('mapOptions'));
        var tiles = leafletModel.get('tiles');
        var baseLayers = {};
        var baseLayerAdded = false;
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = tiles[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var tile = _step.value;

            var tileLayer = L.tileLayer(tile.urlTemplate, tile.options);
            if (tile.label) {
              // only add one baseLayer
              if (!baseLayerAdded) {
                tileLayer.addTo(_map);
                baseLayerAdded = true;
              }
              baseLayers[tile.label] = tileLayer;
            } else {
              // add all tiles without labels into the map
              tileLayer.addTo(_map);
            }
          }
          // add layer control when there are more than two layers
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        if (tiles.length > 1) {
          var layerControlOpts = leafletModel.get('layerControl');
          L.control.layers(baseLayers, {}, layerControlOpts).addTo(_map);
        }

        /*
         Encapsulate viewportRoot element into
         the parent element responsible for moving,
         avoiding direct manipulation of viewportRoot elements
         affecting related attributes such as offset.
        */
        var moveContainer = document.createElement('div');
        moveContainer.style = 'position: absolute;left: 0;top: 0;';
        moveContainer.appendChild(viewportRoot);

        new CustomOverlay(moveContainer).addTo(_map);
      }

      var map = leafletModel.__map;
      leafletCoordSys = new LeafletCoordSys(map, api);
      leafletList.push(leafletCoordSys);
      leafletCoordSys.setMapOffset(leafletModel.__mapOffset || [0, 0]);

      var _leafletModel$get = leafletModel.get('mapOptions'),
          center = _leafletModel$get.center,
          zoom = _leafletModel$get.zoom;

      if (center && zoom) {
        leafletCoordSys.setZoom(zoom);
        leafletCoordSys.setCenter(center);
      }

      leafletModel.coordinateSystem = leafletCoordSys;
    });

    ecModel.eachSeries(function (seriesModel) {
      if (seriesModel.get('coordinateSystem') === 'leaflet') {
        seriesModel.coordinateSystem = leafletCoordSys;
      }
    });

    return leafletList;
  };

  /**
   * find appropriate coordinate system to convert
   * @param {*} methodName
   * @param {*} ecModel
   * @param {*} finder
   * @param {*} value
   * @return {*} converted value
   */
  function doConvert(methodName, ecModel, finder, value) {
    var leafletModel = finder.leafletModel;
    var seriesModel = finder.seriesModel;

    var coordSys = leafletModel ? leafletModel.coordinateSystem : seriesModel ? seriesModel.coordinateSystem || // For map.
    (seriesModel.getReferringComponents('leaflet')[0] || {}).coordinateSystem : null;
    /* eslint-disable no-invalid-this */
    return coordSys === this ? coordSys[methodName](value) : null;
  }

  return LeafletCoordSys;
}

/**
 * extend echarts model
 * @param {object} echarts
 */
function extendLeafletModel(echarts) {
  /**
   * compare if two arrays of length 2 are equal
   * @param {Array} a array of length 2
   * @param {Array} b array of length 2
   * @return {Boolean}
   */
  function v2Equal(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1];
  }

  echarts.extendComponentModel({
    type: 'leaflet',

    getLeaflet: function getLeaflet() {
      // __map is injected when creating LeafletCoordSys
      return this.__map;
    },

    setCenterAndZoom: function setCenterAndZoom(center, zoom) {
      this.option.center = center;
      this.option.zoom = zoom;
    },

    centerOrZoomChanged: function centerOrZoomChanged(center, zoom) {
      var option = this.option;
      return !(v2Equal(center, option.center) && zoom === option.zoom);
    },

    defaultOption: {
      mapOptions: {},
      tiles: [{
        urlTemplate: 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
        options: {
          attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }
      }],
      layerControl: {}
    }
  });
}

/**
 * extend echarts view
 * @param {object} echarts
 */
function extendLeafletView(echarts) {
  echarts.extendComponentView({
    type: 'leaflet',

    render: function render(leafletModel, ecModel, api) {
      var rendering = true;

      var leaflet = leafletModel.getLeaflet();
      var moveContainer = api.getZr().painter.getViewportRoot().parentNode;
      var coordSys = leafletModel.coordinateSystem;

      var moveHandler = function moveHandler(type, target) {
        if (rendering) {
          return;
        }
        var offsetEl = leaflet._mapPane;
        // calculate new mapOffset
        var transformStyle = offsetEl.style.transform;
        var dx = 0;
        var dy = 0;
        if (transformStyle) {
          transformStyle = transformStyle.replace('translate3d(', '');
          var parts = transformStyle.split(',');
          dx = -parseInt(parts[0], 10);
          dy = -parseInt(parts[1], 10);
        } else {
          // browsers that don't support transform: matrix
          dx = -parseInt(offsetEl.style.left, 10);
          dy = -parseInt(offsetEl.style.top, 10);
        }
        var mapOffset = [dx, dy];
        moveContainer.style.left = mapOffset[0] + 'px';
        moveContainer.style.top = mapOffset[1] + 'px';

        coordSys.setMapOffset(mapOffset);
        leafletModel.__mapOffset = mapOffset;

        api.dispatchAction({
          type: 'leafletRoam'
        });
      };

      /**
       * handler for map zoomEnd event
       */
      function zoomEndHandler() {
        if (rendering) return;
        api.dispatchAction({
          type: 'leafletRoam'
        });
      }

      /**
       * handler for map zoom event
       */
      function zoomHandler() {
        moveHandler();
      }

      if (this._oldMoveHandler) {
        leaflet.off('move', this._oldMoveHandler);
      }
      if (this._oldZoomHandler) {
        leaflet.off('zoom', this._oldZoomHandler);
      }
      if (this._oldZoomEndHandler) {
        leaflet.off('zoomend', this._oldZoomEndHandler);
      }

      leaflet.on('move', moveHandler);
      leaflet.on('zoom', zoomHandler);
      leaflet.on('zoomend', zoomEndHandler);

      this._oldMoveHandler = moveHandler;
      this._oldZoomHandler = zoomHandler;
      this._oldZoomEndHandler = zoomEndHandler;

      var _leafletModel$get = leafletModel.get('mapOptions'),
          roam = _leafletModel$get.roam;
      // can move


      if (roam && roam !== 'scale') {
        leaflet.dragging.enable();
      } else {
        leaflet.dragging.disable();
      }
      // can zoom (may need to be more fine-grained)
      if (roam && roam !== 'move') {
        leaflet.scrollWheelZoom.enable();
        leaflet.doubleClickZoom.enable();
        leaflet.touchZoom.enable();
      } else {
        leaflet.scrollWheelZoom.disable();
        leaflet.doubleClickZoom.disable();
        leaflet.touchZoom.disable();
      }

      rendering = false;
    }
  });
}

/**
 * echarts register leaflet coord system
 * @param {object} echarts
 * @param {object} L
 */
function registerLeafletSystem(echarts, L) {
  extendLeafletModel(echarts);
  extendLeafletView(echarts);

  echarts.registerCoordinateSystem('leaflet', createLeafletCoordSystem(echarts, L));

  echarts.registerAction({
    type: 'leafletRoam',
    event: 'leafletRoam',
    update: 'updateLayout'
  }, function (payload, ecModel) {
    ecModel.eachComponent('leaflet', function (leafletModel) {
      var leaflet = leafletModel.getLeaflet();
      var center = leaflet.getCenter();
      leafletModel.setCenterAndZoom([center.lng, center.lat], leaflet.getZoom());
    });
  });
}

registerLeafletSystem.version = '1.0.0';

export default registerLeafletSystem;
