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

var xgds_image = xgds_image || {};

$.extend(xgds_image,{
	hookDelete: function() {
		// Add a click handler for the delete row 
//		$('#delete_images').click( function() {
//		    var selectedRows = getSelectedRows( theDataTable );
//		    // get a list containing just the id's of selected images
//		    var selectedImageIdsList = jQuery.map(selectedRows, function(element) { return jQuery(element).attr('pk'); });
//		    var selectedImageIdsJson = {"pk": selectedImageIdsList};
//			//delete selected images from db
//		    var url = deleteImagesUrl;
//		    $.ajax({
//				url: url,
//				type: "POST",
//				data: selectedImageIdsJson, // serializes the form's elements.
//				success: function(data) {
//					console.log("images successfully deleted");
//				},
//				error: function(request, status, error) {
//					console.log("error! ", error);
//				}
//			})
//			
//			// delete selected rows from datatable.
//		    for (var i = 0; i < selectedRows.length; i++) { 
//		        theDataTable.fnDeleteRow(selectedRows[i]);
//		    }
//		    // re-render the map icons with only the non-deleted images.
//		    showOnMap(theDataTable.fnGetData());
//		} );
	},
	activateButtons: function(el) {
		// Hook up edit info and add note buttons
		el.find("#edit_info_button").click(function(event) {
		    event.preventDefault();
		    el.find("#image_overview").hide();
		    el.find("#more_info_view").show();
		});
		el.find("#cancel_edit").click(function(event) {
		    event.preventDefault();
		    el.find("#more_info_view").hide();
		    el.find("#image_overview").show();
		});
		el.find(".add_note_button").click(function(event) {
		    event.preventDefault();
		    el.find("#notes_input").show();
		});
	},
	onImageNextOrPrev: function(el){
		el.find('.next-button').click(function(event) {
			// set the img src
			var index = xgds_image.getCurrentImageAndIndex(el);
			if (index != null) {
			    index = index + 1;
			    if (index == imageSetsArray.length){
			    	index = 0;
			    }
			    clearTableSelection(theDataTable);
			    xgds_image.updateImageView(el, null, index, false, false);
			}
		});
		el.find(".prev-button").click(function(event) {
			var index = xgds_image.getCurrentImageAndIndex(el);
			if (index != null) {
			    index = index - 1;
			    if (index < 0){
				index = imageSetsArray.length - 1;
			    }
			    clearTableSelection(theDataTable);
			    xgds_image.updateImageView(el, null, index, false, false);
			}
		});
	},
	setChangedPosition: function(value, el){
		$(el).find('#id_changed_position').attr('value', value);
	},
	hookEditingPosition: function(el){
		// Set the changed_position to true if the user edits any of the position fields.
		$(el).find("#id_latitude").change(function() {setChangedPosition(1, el)});
		$(el).find("#id_longitude").change(function() {setChangedPosition(1, el)});
		$(el).find("#id_altitude").change(function() {setChangedPosition(1, el)});
		$(el).find("#id_heading").change(function() {setChangedPosition(1, el)});
	},
	onUpdateImageInfo: function(el) {
		// Saves image info to the db when user updates it and submits.
		$(el).find("#updateInfoSubmit").on('click', function(event) {
			event.preventDefault(); 	// avoid to execute the actual submit of the form.
			var url = updateImageUrl; // the script where you handle the form input.
			var postData = $("#more-info-form").serialize();
			$.ajax({
				url: url,
				type: "POST",
				data: postData, // serializes the form's elements.
				success: function(data)
				{
				    xgds_image.setSaveStatusMessage($('#message'), 'Saved','');
				    xgds_image.updateImageView(el, data[0], undefined, true, true);
				    el.find("#more_info_view").hide();
				    el.find("#image_overview").show();
				},
				error: function(request, status, error) {
				    xgds_image.setSaveStatusMessage($('#message'), status, error);
				}
			});
			return false; 
		});
	},
	getCurrentImageAndIndex: function(el){
		// Helper that finds index in imageSetsArray
		// of the currently displayed image in the imageView.
		var currentImageName = el.attr('pk');
		var currentImageIndex = null;
		for (var i=0; i< imageSetsArray.length; i++) {
			if (imageSetsArray[i]['name'] == currentImageName) {
				currentImageIndex = i;
				break;
			}
		}
		return currentImageIndex;
	},
	stopTiles: function() {
		if (!_.isUndefined(this.viewer)){
			this.viewer._cancelPendingImages();
		}
	},
	updateImageView: function(el, imageJson, index, keepingImage, keepingNotes) {
		if (imageJson == null){
			if (index != null) {
				imageJson = imageSetsArray[index];
			} else {
				return;
			}
		}

		if (!keepingNotes){
			var tbl = el.find('table.notes_list');
			xgds_notes.initializeNotesReference(el, imageJson['app_label'], imageJson['model_type'], imageJson['pk'], imageJson['acquisition_time'], imageJson['acquisition_timezone']);
			xgds_notes.getNotesForObject(imageJson['app_label'], imageJson['model_type'], imageJson['pk'], 'notes_content', tbl);
		}
		
		var newContent = this.compiledTemplate(imageJson);
		$(el).html(newContent);

		if (!keepingImage){
			this.setupImageViewer(imageJson);
	    }
	},
	constructImageView: function(imageJson) {
		var modelMap = app.options.searchModels['Photo'];
		var url = '/xgds_core/handlebar_string/' + modelMap.viewHandlebars;
		$.when($.get(url, function(handlebarSource, status){
			app.showDetailView(handlebarSource, imageJson, modelMap, 'Photo');
		}));
	},
	loadImageInViewer: function(imageJson){
		this.setupImageViewer(imageJson);
	},
	hideImageNextPrev: function() {
		$('.prev-button').hide();
		$('.next-button').hide();
		$('#new-window-btn').hide();
	},
	saveRotationDegrees: function(imageJson, degrees) {
		// save rotation degrees to the database
		imageJson['rotation_degrees'] = degrees; 
		var postData = imageJson;
		var url = app.options.searchModels.Photo.saveRotationUrl;
		// get rotation degrees from db, compare to degrees. 
		// this gets called when user switches the view to another image.
		// call ajax to save the rotation degrees. 
		$.ajax({
			url: url,
			type: "POST",
			data: postData, // serializes the form's elements.
			success: function(data) {
			},
			error: function(request, status, error) {
				//console.log("error! ", error)
			}
		});
	},
	setOpenseadragonRotation: function(osd_viewer, imagePK){
		var getData = {'imagePK': imagePK };
		var url = app.options.searchModels.Photo.getRotationUrl;
		$.ajax({
			url: url,
			type: "POST",
			data: getData, // serializes the form's elements.
			success: function(data) {
				osd_viewer.viewport.setRotation(data['rotation_degrees'])
			},
			error: function(request, status, error) {
				console.log("error! ", error);
			}
		});
	},
	removeViewer: function() {
		if (!_.isUndefined(this.viewer)){
			this.viewer._cancelPendingImages();
			this.viewer.destroy();
			this.viewer = undefined;
		}
	},
	showRawImage: function(imageJson){
		var rawImage = imageJson.raw_image_url; 
		this.removeViewer();
		try {
			$(".openseadragon-container").hide();
		} catch (err){
			// pass
		}
		$('#display-image').prepend('<img id="raw-image" class="img-fluid" src="' + rawImage + '" />');
	},
	setupImageViewer: function(imageJson){
		if (this.viewer != undefined){
			//TODO this should really be appropriate but somehow updateContents is being triggered many times
//			if (this.viewer.imageJson.pk == imageJson.pk){
//				return;
//			}
			this.removeViewer();
			//TODO WILLIAM put in some clearAnnotations
		} 
		// try removing the raw image
		try {
			$("#raw-image").remove();  // or destroy();
		} catch (err) {
			//pass
		}
		
		var tiledImage = imageJson.deepzoom_file_url;

		if (imageJson.create_deepzoom || _.isEmpty(tiledImage)){
			// tiles are not ready yet, let's make sure:
			$.ajax({
				  dataType: "json",
				  url: '/xgds_image/checkTiles/' + imageJson.pk,
				  success: function(data) {
					  imageJson.create_deepzoom = data.create_deepzoom; 
					  imageJson.deepzoom_file_url = data.deepzoom_file_url;
					  tiledImage = data.deepzoom_file_url;
				  },
				  error: function(){
					  // use the old state
				  },
				  async: false
				});
			
			/* Hardcore showRawImage (don't check if image is tiled) */
			this.showRawImage(imageJson);
			return;
		}
		
		
		// build tile sources for openseadragon image viewer
		var prefixUrl = '/static/openseadragon/built-openseadragon/openseadragon/images/';
		try {
			var displayImage = $('#display-image');
			if (displayImage.length == 0){
				throw ('Cound not find display-image div');
			} else {
				displayImage = displayImage[0];
			}
			this.viewer = OpenSeadragon({
				element: displayImage,
//				id: "display-image",
				prefixUrl: prefixUrl,
				tileSources: tiledImage,
			    showRotationControl: true,
			    imageJson: imageJson,
			 	gestureSettingsMouse:   {
 	            	clickToZoom: false
 		        }
			});
			this.viewer['viewer_initialized'] = true;
			this.setOpenseadragonRotation(this.viewer, imageJson['pk']);
			
			// Add handlers for full-screen event and rotation event.
			this.viewer.addHandler('full-screen', function (viewer) {
				// grab the canvas from the viewer and reset the size.
				var element = viewer.eventSource.element; // #display-image
				var osd_canvas = $(element).find('.openseadragon-canvas'); // somehow change the style -- test with funky values.
				osd_canvas.width("100%");
				osd_canvas.height("100%");
			});
			
			var failDict = {imageJson: imageJson};
			this.viewer.addHandler('open-failed', function(inputDict) {
				// If the tiles are not there or not ready, then open the raw image
				xgds_image.showRawImage(inputDict.userData.imageJson);
			}, failDict);
			
			this.viewer.addHandler('tile-load-failed', function(inputDict) {
				// If the tiles are not there or not ready, then open the raw image
				// do not expect the data here
				xgds_image.showRawImage(inputDict.userData.imageJson);
			}, failDict);
			
			// add a handler for rotation that saves the rotation degrees to the database. 
			var context = this;
			this.viewer.addHandler('rotate', function(viewer) {
				if (context.viewer['viewer_initialized'] != true) {
					var element = viewer.eventSource.element;
					var degrees = viewer.degrees;
					var userData = viewer.userData;
					// save the rotation to the db.
					context.saveRotationDegrees(imageJson, degrees);
				} else { // viewer is initialized. 
					// set the initialized flag to false
					context.viewer['viewer_initialized'] = false
				}
				
			});
			xgds_image_annotation.initialize(imageJson, this.viewer);
		} catch (err) {
			console.log(err);
		}
	},
	resizeImageViewer: function(element) {
		// when viewDiv resize,  
		// element is the view-div
		var element = $(element);
		
		var newWidth = element.width();
		var newHeight = element.height();
		
		var wrapper = element.find('.image-wrapper');
		wrapper.width(newWidth);
		wrapper.height(newHeight);
		
		var osd_viewer = wrapper.find('#display-image');
		osd_viewer.width(newWidth);
		osd_viewer.height(newHeight);
		
		var osd_canvas = osd_viewer.find('.openseadragon-canvas');
		osd_canvas.width(newWidth);
		osd_canvas.height(newHeight);
	},
	setSaveStatusMessage: function(handler, status, msg){
		if (status == 'success') {
			handler.attr('class', 'success-message');
		} else {
			handler.attr('class', 'error-message');
		}
		handler.html(msg);
		setTimeout(function() { // messages fades out.
			handler.fadeOut().empty();
		}, 5000);
	}
});
