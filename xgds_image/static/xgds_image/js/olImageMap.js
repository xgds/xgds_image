// render json image information on the openlayers map

var ImageSet = {
        initStyles: function() {
            if (_.isUndefined(this.styles)){
                this.styles = {};
                this.styles['iconStyle'] = new ol.style.Style({
                    image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
                        src: '/static/xgds_image/images/photo.png',
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
                    var noteFeature = this.constructMapElement(imagesJson[i]);
                    olFeatures = olFeatures.concat(noteFeature);
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
                name: imageJson.creation_time,
                uuid: imageJson.id,
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
            var formattedString = "<img src='%s'></img><br/><table>";
            for (j = 0; j< 7; j++){
                formattedString = formattedString + trString;
            }
            formattedString = formattedString + "</table>";
            var data = [imageJson.thumbnail_image_url,
                        "Note:", imageJson.description,
                        "Time:", imageJson.creation_time,
                        "Author:", imageJson.author_name,
                        "Camera:", imageJson.camera_name,
                        "Altitude:", imageJson.altitude + " m",
                        "Lat:", imageJson.lat,
                        "Lon:", imageJson.lon
                        ];
            var popupContents = vsprintf(formattedString, data);
            feature['popup'] = popupContents;
        		
        }
}