import React from 'react';
import T from 'prop-types';
import styled, { withTheme } from 'styled-components';
import mapboxgl from 'mapbox-gl';
import CompareMbGL from 'mapbox-gl-compare';

import config from '../../config';
import { layerTypes } from '../common/layers/types';
import { glsp } from '../../styles/utils/theme-values';
import mbAoiDraw from './mb-aoi-draw';

const {
  center,
  zoom,
  minZoom,
  maxZoom,
  styleUrl
} = config.map;

// Set mapbox token.
mapboxgl.accessToken = config.mbToken;
localStorage.setItem('MapboxAccessToken', config.mbToken);

const MapsContainer = styled.div`
  position: relative;
  overflow: hidden;
  height: 100%;

  /* Styles to accommodate the partner logos */
  .mapboxgl-ctrl-bottom-left {
    display: flex;
    align-items: center;
    flex-direction: row-reverse;

    > .mapboxgl-ctrl {
      margin: 0 ${glsp(0.5)} 0 0;
    }
  }

  .partner-logos {
    display: flex;
    img {
      display: block;
      height: 3rem;
    }

    a {
      display: block;
    }

    > *:not(:last-child) {
      margin: 0 ${glsp(0.5)} 0 0;
    }
  }
`;

const SingleMapContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

class MbMap extends React.Component {
  constructor (props) {
    super(props);
    this.mapContainer = null;
    this.mbMap = null;
    this.mbDraw = null;
  }

  componentDidMount () {
    // Mount the map on the net tick to prevent the right side gap.
    setTimeout(() => this.initMap(), 1);
  }

  componentDidUpdate (prevProps, prevState) {
    const { activeLayers, comparing } = this.props;

    // Compare Maps
    if (comparing !== prevProps.comparing) {
      if (comparing) {
        this.mbMap.resize();
        this.mbMapComparing = new mapboxgl.Map({
          attributionControl: false,
          container: this.mapContainerComparing,
          center: this.mbMap.getCenter(),
          zoom: this.mbMap.getZoom(),
          minZoom: minZoom || 4,
          maxZoom: maxZoom || 9,
          style: styleUrl,
          pitchWithRotate: false,
          dragRotate: false,
          logoPosition: 'bottom-left'
        });

        // Add zoom controls.
        this.mbMapComparing.addControl(new mapboxgl.NavigationControl(), 'top-left');

        // Style attribution.
        this.mbMapComparing.addControl(new mapboxgl.AttributionControl({ compact: true }));

        // Remove compass.
        document.querySelector('.mapboxgl-ctrl .mapboxgl-ctrl-compass').remove();

        this.mbMapComparing.once('load', () => {
          this.mbMapComparingLoaded = true;
          this.updateActiveLayers(prevProps);
        });

        this.compareControl = new CompareMbGL(this.mbMap, this.mbMapComparing, '#container');
      } else {
        if (this.compareControl) {
          this.compareControl.remove();
          this.compareControl = null;
          this.mbMapComparing.remove();
          this.mbMapComparing = null;
          this.mbMapComparingLoaded = false;
        }
      }
    }

    // TODO: Improve how compare is handled, by the layers that have it.
    if (prevProps.activeLayers !== activeLayers || comparing !== prevProps.comparing) {
      const toRemove = prevProps.activeLayers.filter(
        (l) => !activeLayers.includes(l)
      );
      const toAdd = activeLayers.filter(
        (l) => !prevProps.activeLayers.includes(l)
      );

      toRemove.forEach((layerId) => {
        const layerInfo = this.props.layers.find((l) => l.id === layerId);
        const fns = layerTypes[layerInfo.type];
        if (fns) {
          return fns.hide(this, layerInfo, prevProps);
        }
        /* eslint-disable-next-line no-console */
        console.error('No functions found for layer type', layerInfo.type);
      });

      toAdd.forEach(async (layerId) => {
        const layerInfo = this.props.layers.find((l) => l.id === layerId);
        const fns = layerTypes[layerInfo.type];
        if (fns) {
          fns.show(this, layerInfo, prevProps);
          if (fns.update) {
            fns.update(this, layerInfo, prevProps);
          }
          return;
        }
        /* eslint-disable-next-line no-console */
        console.error('No functions found for layer type', layerInfo.type);
      });
    }

    // Update all active layers.
    this.updateActiveLayers(prevProps);

    // Handle aoi state props update.
    if (this.mbDraw) {
      this.mbDraw.update(prevProps.aoiState, this.props.aoiState);
    }
  }

  updateActiveLayers (prevProps) {
    this.props.activeLayers.forEach((layerId) => {
      const layerInfo = this.props.layers.find((l) => l.id === layerId);
      const fns = layerTypes[layerInfo.type];
      if (fns && fns.update) {
        return fns.update(this, layerInfo, prevProps);
      }
    });
  }

  initMap () {
    this.mbMap = new mapboxgl.Map({
      attributionControl: false,
      container: this.mapContainer,
      center: center,
      zoom: zoom || 5,
      minZoom: minZoom || 4,
      maxZoom: maxZoom || 9,
      style: styleUrl,
      pitchWithRotate: false,
      dragRotate: false,
      logoPosition: 'bottom-left'
    });

    // Disable map rotation using right click + drag.
    this.mbMap.dragRotate.disable();

    // Disable map rotation using touch rotation gesture.
    this.mbMap.touchZoomRotate.disableRotation();

    // Add zoom controls.
    this.mbMap.addControl(new mapboxgl.NavigationControl(), 'top-left');

    // Style attribution
    this.mbMap.addControl(new mapboxgl.AttributionControl({ compact: true }));

    // Remove compass.
    document.querySelector('.mapboxgl-ctrl .mapboxgl-ctrl-compass').remove();

    // Setup the AIO drawing functions.
    if (this.props.aoiState) {
      this.mbDraw = mbAoiDraw(this.mbMap);
      const { feature } = this.props.aoiState;
      this.mbDraw.setup(this.props.onAction, feature ? [feature] : null, this.props.theme);
    }

    this.mbMap.on('load', () => {
      this.props.onAction('map.loaded');
    });
  }

  render () {
    return (
      <MapsContainer id='container'>
        <SingleMapContainer
          ref={(el) => {
            this.mapContainerComparing = el;
          }}
        />
        <SingleMapContainer
          ref={(el) => {
            this.mapContainer = el;
          }}
        />
      </MapsContainer>
    );
  }
}

MbMap.propTypes = {
  onAction: T.func,
  theme: T.object,
  aoiState: T.object,
  comparing: T.bool,
  activeLayers: T.array,
  layers: T.array
};

export default withTheme(MbMap);