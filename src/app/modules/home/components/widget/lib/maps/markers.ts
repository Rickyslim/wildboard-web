import L from 'leaflet';
import { MarkerSettings } from './map-models';
import { aspectCache, safeExecute, parseFunction } from '@app/core/utils';
import { createTooltip } from './maps-utils';

export class Marker {

    leafletMarker: L.Marker;

    tooltipOffset;
    tooltip;
    location;
    data;
    dataSources;

    constructor(private map: L.Map, location: L.LatLngExpression, public settings: MarkerSettings, data, dataSources, onClickListener?, markerArgs?, onDragendListener?) {
        //this.map = map;
        this.location = location;
        this.setDataSources(data, dataSources)
        this.leafletMarker = L.marker(location, {
            draggable: settings.draggable
        });

        this.createMarkerIcon((iconInfo) => {
            this.leafletMarker.setIcon(iconInfo.icon);
            if (settings.showLabel) {
                this.tooltipOffset = [0, -iconInfo.size[1] + 10];
               // this.updateMarkerLabel(settings)
            }

            this.leafletMarker.addTo(map)
        }
        );

        if (settings.displayTooltip) {
            this.tooltip = createTooltip(this.leafletMarker, settings, markerArgs);
        }

        if (onClickListener) {
            this.leafletMarker.on('click', onClickListener);
        }

        if (onDragendListener) {
            this.leafletMarker.on('dragend', onDragendListener);
        }

    }

    setDataSources(data, dataSources) {
        this.data = data;
        this.dataSources = dataSources;
    }

    updateMarkerPosition(position: L.LatLngExpression) {
        this.leafletMarker.setLatLng(position);
    }

    updateMarkerLabel(settings) {

        function getText(template, data) {
            let res = null;
            try {
                let variables = '';
                for (let key in data) {
                    if (!key.includes('|'))
                        variables += `var ${key} = '${data[key]}';`;
                }
                res = safeExecute(parseFunction(variables + 'return' + '`' + template + '`'));
            }
            catch (ex) {
            }
            return res;
        }


        this.leafletMarker.unbindTooltip();
        if (settings.showLabel) {
            if (settings.useLabelFunction) {
                settings.labelText = safeExecute(settings.labelFunction, [this.data, this.dataSources, this.data.dsIndex])
            }
            else settings.labelText = getText(settings.label, this.data);

            this.leafletMarker.bindTooltip(`<div style="color: ${settings.labelColor};"><b>${settings.labelText}</b></div>`,
                { className: 'tb-marker-label', permanent: true, direction: 'top', offset: this.tooltipOffset });
        }
    }

    updateMarkerColor(color) {
        this.createDefaultMarkerIcon(color, (iconInfo) => {
            this.leafletMarker.setIcon(iconInfo.icon);
        });
    }

    updateMarkerIcon(settings) {
        this.createMarkerIcon((iconInfo) => {
            this.leafletMarker.setIcon(iconInfo.icon);
            if (settings.showLabel) {
                this.tooltipOffset = [0, -iconInfo.size[1] + 10];
                this.updateMarkerLabel(settings)
            }
        });
    }

    createMarkerIcon(onMarkerIconReady) {

        if (this.settings.icon) {
            onMarkerIconReady({
                size: [30,30],
                icon: this.settings.icon,
            });
            return;
        }

        let currentImage = this.settings.useMarkerImageFunction ?
            safeExecute(this.settings.markerImageFunction,
                [this.data, this.settings.markerImages, this.dataSources, this.data.dsIndex]) : this.settings.currentImage;
       
        
        if (currentImage && currentImage.url) {
            aspectCache(currentImage.url).subscribe(
                (aspect) => {
                    if (aspect) {
                        var width;
                        var height;
                        if (aspect > 1) {
                            width = currentImage.size;
                            height = currentImage.size / aspect;
                        } else {
                            width = currentImage.size * aspect;
                            height = currentImage.size;
                        }
                        var icon = L.icon({
                            iconUrl: currentImage.url,
                            iconSize: [width, height],
                            iconAnchor: [width / 2, height],
                            popupAnchor: [0, -height]
                        });
                        var iconInfo = {
                            size: [width, height],
                            icon: icon
                        };
                        onMarkerIconReady(iconInfo);
                    } else {
                        this.createDefaultMarkerIcon(this.settings.color, onMarkerIconReady);
                    }
                }
            );
        } else {
            this.createDefaultMarkerIcon(this.settings.color, onMarkerIconReady);
        }
    }

    createDefaultMarkerIcon(color, onMarkerIconReady) {
        var pinColor = color.substr(1);
        var icon = L.icon({
            iconUrl: 'https://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|' + pinColor,
            iconSize: [21, 34],
            iconAnchor: [10, 34],
            popupAnchor: [0, -34],
            shadowUrl: 'https://chart.apis.google.com/chart?chst=d_map_pin_shadow',
            shadowSize: [40, 37],
            shadowAnchor: [12, 35]
        });
        var iconInfo = {
            size: [21, 34],
            icon: icon
        };
        onMarkerIconReady(iconInfo);
    }



    removeMarker() {
        /*     this.map$.subscribe(map =>
                 this.leafletMarker.addTo(map))*/
    }

    extendBoundsWithMarker(bounds) {
        bounds.extend(this.leafletMarker.getLatLng());
    }

    getMarkerPosition() {
        return this.leafletMarker.getLatLng();
    }

    setMarkerPosition(latLng) {
        this.leafletMarker.setLatLng(latLng);
    }
}