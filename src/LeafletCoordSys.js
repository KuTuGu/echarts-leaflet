import { util, graphic, matrix } from 'echarts/lib/echarts';
import L from 'leaflet/src/Leaflet';
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

LeafletCoordSys.prototype.dimensions = ['lng', 'lat'];

LeafletCoordSys.prototype.setZoom = function(zoom) {
  this._zoom = zoom;
};

LeafletCoordSys.prototype.setCenter = function(center) {
  this._center = this._projection.project(new L.LatLng(center[1], center[0]));
};

LeafletCoordSys.prototype.setMapOffset = function(mapOffset) {
  this._mapOffset = mapOffset;
};

LeafletCoordSys.prototype.getLeaflet = function() {
  return this._map;
};

LeafletCoordSys.prototype.dataToPoint = function(data) {
  const point = new L.LatLng(data[1], data[0]);
  const px = this._map.latLngToLayerPoint(point);
  const mapOffset = this._mapOffset;
  return [px.x - mapOffset[0], px.y - mapOffset[1]];
};

LeafletCoordSys.prototype.pointToData = function(pt) {
  const mapOffset = this._mapOffset;
  const coord = this._map.layerPointToLatLng({
    x: pt[0] + mapOffset[0],
    y: pt[1] + mapOffset[1],
  });
  return [coord.lng, coord.lat];
};

LeafletCoordSys.prototype.convertToPixel = util.curry(
  doConvert,
  'dataToPoint'
);

LeafletCoordSys.prototype.convertFromPixel = util.curry(
  doConvert,
  'pointToData'
);

/**
 * find appropriate coordinate system to convert
 * @param {*} methodName
 * @param {*} ecModel
 * @param {*} finder
 * @param {*} value
 * @return {*} converted value
 */
function doConvert(methodName, ecModel, finder, value) {
  let leafletModel = finder.leafletModel;
  let seriesModel = finder.seriesModel;

  let coordSys = leafletModel
    ? leafletModel.coordinateSystem
    : seriesModel
      ? seriesModel.coordinateSystem || // For map.
        (seriesModel.getReferringComponents('leaflet')[0] || {})
          .coordinateSystem
      : null;
  /* eslint-disable no-invalid-this */
  return coordSys === this ? coordSys[methodName](value) : null;
}

LeafletCoordSys.prototype.getViewRect = function() {
  const api = this._api;
  return new graphic.BoundingRect(0, 0, api.getWidth(), api.getHeight());
};

LeafletCoordSys.prototype.getRoamTransform = function() {
  return matrix.create();
};

LeafletCoordSys.dimensions = LeafletCoordSys.prototype.dimensions;

const CustomOverlay = L.Layer.extend({
  initialize: function(container) {
    this._container = container;
  },

  onAdd: function(map) {
    let pane = map.getPane(this.options.pane);
    pane.appendChild(this._container);

    // Calculate initial position of container with
    // `L.Map.latLngToLayerPoint()`, `getPixelOrigin()
    // and/or `getPixelBounds()`

    // L.DomUtil.setPosition(this._container, point);

    // Add and position children elements if needed

    // map.on('zoomend viewreset', this._update, this);
  },

  onRemove: function(map) {
    L.DomUtil.remove(this._container);
    // map.off('zoomend viewreset', this._update, this);
  },

  _update: function() {
    // Recalculate position of container
    // L.DomUtil.setPosition(this._container, point);
    // Add/remove/reposition children elements if needed
  },
});

LeafletCoordSys.create = function(ecModel, api) {
  let leafletCoordSys;
  let leafletList = [];
  const root = api.getDom();

  // TODO Dispose
  ecModel.eachComponent('leaflet', function(leafletModel) {
    let viewportRoot = api.getZr().painter.getViewportRoot();
    if (typeof L === 'undefined') {
      throw new Error('Leaflet api is not loaded');
    }
    if (leafletCoordSys) {
      throw new Error('Only one leaflet component can exist');
    }
    if (!leafletModel.__map) {
      // Not support IE8
      let mapRoot = root.querySelector('.ec-extension-leaflet');
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
      let map = (leafletModel.__map = L.map(mapRoot));
      const tiles = leafletModel.get('tiles');
      let baseLayers = {};
      let baseLayerAdded = false;
      for (let tile of tiles) {
        let tileLayer = L.tileLayer(tile.urlTemplate, tile.options);
        if (tile.label) {
          // only add one baseLayer
          if (!baseLayerAdded) {
            tileLayer.addTo(map);
            baseLayerAdded = true;
          }
          baseLayers[tile.label] = tileLayer;
        } else {
          // add all tiles without labels into the map
          tileLayer.addTo(map);
        }
      }
      // add layer control when there are more than two layers
      if (tiles.length > 1) {
        const layerControlOpts = leafletModel.get('layerControl');
        L.control.layers(baseLayers, {}, layerControlOpts).addTo(map);
      }

      /*
       Encapsulate viewportRoot element into
       the parent element responsible for moving,
       avoiding direct manipulation of viewportRoot elements
       affecting related attributes such as offset.
      */
      let moveContainer = document.createElement('div');
      moveContainer.style = 'position: absolute;left: 0;top: 0;';
      moveContainer.appendChild(viewportRoot);

      new CustomOverlay(moveContainer).addTo(map);
    }
    let map = leafletModel.__map;

    // Set leaflet options
    // centerAndZoom before layout and render
    const center = leafletModel.get('center');
    const zoom = leafletModel.get('zoom');
    if (center && zoom) {
      map.setView([center[1], center[0]], zoom);
    }

    leafletCoordSys = new LeafletCoordSys(map, api);
    leafletList.push(leafletCoordSys);
    leafletCoordSys.setMapOffset(leafletModel.__mapOffset || [0, 0]);
    leafletCoordSys.setZoom(zoom);
    leafletCoordSys.setCenter(center);

    leafletModel.coordinateSystem = leafletCoordSys;
  });

  ecModel.eachSeries(function(seriesModel) {
    if (seriesModel.get('coordinateSystem') === 'leaflet') {
      seriesModel.coordinateSystem = leafletCoordSys;
    }
  });

  return leafletList;
};

export default LeafletCoordSys;
