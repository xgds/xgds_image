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
			this.loadImageInViewer(imageJson);
	    }
	},
	hideImageNextPrev: function() {
		$('.prev-button').hide();
		$('.next-button').hide();
		$('#new-window-btn').hide();
	},
	constructImageView: function(imageJson, viewPage){
		var imageViewWidget = $("#image_view");
		if (imageViewWidget.length) {
			this.updateImageView(imageViewWidget, imageJson, null, false, false);
		} else {
	        Handlebars.registerHelper('prettyTime', function( sourceTime, timeZone ){
	        	return getLocalTimeString(sourceTime, timeZone);
	        });

			viewPage = typeof viewPage !== 'undefined' ? viewPage : false;
			var rawTemplate = $('#template-image-view').html();
			this.compiledTemplate = Handlebars.compile(rawTemplate);

			var newDiv = this.compiledTemplate(imageJson);
			var imageViewTemplate = $(newDiv);

			// callbacks
			this.hookEditingPosition(imageViewTemplate);
			this.onUpdateImageInfo(imageViewTemplate);
			this.activateButtons(imageViewTemplate);
			this.hookDelete();

			if (!viewPage){
				this.onImageNextOrPrev(imageViewTemplate);
			}

			// append the div to the container and gridstack.
			var newEl;
			var container = $('#container');

			if (!viewPage){
				newEl = container.append(imageViewTemplate);
			} else {
				newEl = container.prepend(imageViewTemplate);
			}
			// add the element to the dashboard
			if (!viewPage){
				addItem(imageViewTemplate, 3, 3, 3, 2);
			}
			//	// set the loading image to be displayed when main img is loading
			//	imageViewTemplate.find(".display-image").load(function() {
			//	// set dimensions of loading image
			//	var width = imageViewTemplate.find(".display-image").width();
			//	var height = imageViewTemplate.find(".display-image").height();
			//	imageViewTemplate.find(".loading-image").width(width);	
			//	imageViewTemplate.find(".loading-image").height(height);
			//	imageViewTemplate.find(".loading-image").hide();
			//	});
			//	setChangedPosition(0, imageViewTemplate);

			//add the notes if it does not exist
			var notes_content_div = imageViewTemplate.find("#notes_content");
			var notes_table = undefined;
			if ($(notes_content_div).is(':empty')){
				// the first time we want to fill it in
				notes_table = $.find("table.notes_list");
				var notes_input_div = $.find("#notes_input");

				var new_input_div = $(notes_input_div).hide();
				$(notes_content_div).append(new_input_div);

				var new_table_div = $(notes_table);
				$(notes_content_div).append(new_table_div);
				$(new_table_div).removeAttr('hidden');
				$(new_table_div).show();

				var taginput = $(new_input_div).find('.taginput');
				xgds_notes.initializeInput(taginput);
				xgds_notes.hookNoteSubmit();

			} else {
				notes_table = imageViewTemplate.find("table.notes_list");
			}

			xgds_notes.initializeNotesReference(imageViewTemplate, imageJson['app_label'], imageJson['model_type'], imageJson['id'], imageJson['creation_time']);
			xgds_notes.getNotesForObject(imageJson['app_label'], imageJson['model_type'], imageJson['id'], 'notes_content', $(notes_table));

			// set the gridstack image height
			$('.image_view_outer').attr('data-gs-height', '4');

			this.setupImageViewer(imageJson);
		}
	},
	setupImageViewer: function(imageJson){
		if (this.viewer != undefined){
			this.viewer.destroy();
			this.viewer = null;
		}
		// build tile sources for openseadragon image viewer
		var prefixUrl = '/static/openseadragon/built-openseadragon/openseadragon/images/';
		this.viewer = OpenSeadragon({
			id: "display-image",
			prefixUrl: prefixUrl,
			tileSources: {
				type: 'image',
				url: imageJson.raw_image_url
			}
		});
		
	},
	loadImageInViewer: function(imageJson){
		this.setupImageViewer(imageJson);
		return;
    	// load new image into OpenSeadragon viewer
		if (this.viewer == undefined){
			this.setupImageViewer(imageJson);
		} else {
			this.viewer.open({type: 'image', 
							  url: imageJson.raw_image_url});
		}
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
