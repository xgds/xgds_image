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
        initStyles: function() {
            if (_.isUndefined(this.styles)){
                this.styles = {};
                this.styles['iconStyle'] = new ol.style.Style({
                    image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
                        src: '/static/xgds_image/images/photo_heading.png',
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
                name: "Notes",
                source: new ol.source.Vector({
                    features: olFeatures
                }),
            });  
            return vectorLayer;
        },
        constructMapElement:function(imageJson){
            var coords = transform([imageJson.lon, imageJson.lat]);
            var feature = new ol.Feature({
                name: imageJson.acquisition_time,
                uuid: imageJson.pk,
                geometry: new ol.geom.Point(coords)
            });
            feature.setStyle(this.getStyles(imageJson));
            this.setupPopup(feature, imageJson);
            return feature;
        },
        getStyles: function(imageJson) {
            var styles = [this.styles['iconStyle']];
            return styles;
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
                        "Altitude:", imageJson.altitude + " m",
                        "Heading", imageJson.heading,
                        "Lat:", imageJson.lat,
                        "Lon:", imageJson.lon
                        ];
            var popupContents = vsprintf(formattedString, data);
            feature['popup'] = popupContents;
        }
}