//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__

// render json image information on the openlayers map
var Photo = {
		selectedStylePath: '/static/xgds_image/images/photo_heading_selected.png',
		stylePath: '/static/xgds_image/images/photo_heading.png',
        initStyles: function() {
            if (_.isUndefined(this.styles)){
                this.styles = {};
                this.styles['iconStyle'] = new ol.style.Style({
                    image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
                        src: this.stylePath,
                        scale: 1.0
                        }))
                      });
                this.styles['selectedIconStyle'] = new ol.style.Style({
                    image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
                        src: this.selectedStylePath,
                        scale: 1.0
                        }))
                      });
                this.styles['text'] = {
                    font: '12px Calibri,sans-serif',
                    fill: new ol.style.Fill({
                        color: 'black'
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'yellow',
                        width: 2
                    }),
                    offsetY: -15
                };
            }
        },
        buildStyle: function(heading, selected){
        	if (_.isUndefined(heading) || _.isNull(heading)){
        		heading = 0;
        	}
        	if (_.isUndefined(selected) || _.isNull(selected)){
        		selected = false;
        	}
        	var zIndex=1;
        	var stylePath = this.stylePath;
        	if (selected){
        		stylePath = this.selectedStylePath;
        		zIndex=10;
        	}
        	
        	return new ol.style.Style({
        		zIndex: zIndex,
                image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
                    src: stylePath,
                    scale: 1.0,
                    rotation: heading * (Math.PI/180.0)
                    }))
                  });
        },
        constructElements: function(imagesJson){
            if (_.isEmpty(imagesJson)){
                return null;
            }
            this.initStyles();
            var olFeatures = [];
            for (var i = 0; i < imagesJson.length; i++) {
                if (imagesJson[i].lat !== "") {
                    var imageFeature = this.constructMapElement(imagesJson[i]);
                    olFeatures = olFeatures.concat(imageFeature);
                }
            }
            var vectorLayer = new ol.layer.Vector({
                name: imagesJson[0].type,
                source: new ol.source.Vector({
                    features: olFeatures
                }),
            });  
            return vectorLayer;
        },
        constructMapElement:function(imageJson){
            var coords = transform([imageJson.lon, imageJson.lat]);
            var feature = new ol.Feature({
            	type: imageJson.type,
            	view_url: imageJson.view_url,
                name: imageJson.name,
                uuid: imageJson.pk,
                pk: imageJson.pk,
                geometry: new ol.geom.Point(coords)
            });
            feature.setStyle(this.buildStyle(imageJson.head));
            feature.setId(imageJson.type + imageJson.pk);
            this.setupPopup(feature, imageJson);
            return feature;
        },
        selectMapElement:function(feature){
        	var heading = feature.getStyle().getImage().getRotation();
        	heading = heading / (Math.PI/180.0);
        	feature.setStyle(this.buildStyle(heading, true));
        },
        deselectMapElement:function(feature){
        	var heading = feature.getStyle().getImage().getRotation();
        	heading = heading / (Math.PI/180.0);
        	feature.setStyle(this.buildStyle(heading, false));
        },
        setupPopup: function(feature, imageJson) {
            var trString = "<tr><td>%s</td><td>%s</td></tr>";
            var formattedString = "<a href='%s' target='_blank'><img src='%s'></img></a><br/><table>";
            for (j = 0; j< 8; j++) {
                formattedString = formattedString + trString;
            }
            formattedString = formattedString + "</table>";
            var data = [imageJson.view_url,
                        imageJson.thumbnail_image_url,
                        "Note:", imageJson.description,
                        "Time:", imageJson.acquisition_time,
                        "Author:", imageJson.author_name,
                        "Camera:", imageJson.camera_name,
                        "Altitude:", imageJson.alt + " m",
                        "Heading", imageJson.head,
                        "Lat:", imageJson.lat,
                        "Lon:", imageJson.lon
                        ];
            var popupContents = vsprintf(formattedString, data);
            feature['popup'] = popupContents;
        }
}