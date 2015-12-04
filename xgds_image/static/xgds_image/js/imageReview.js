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

var $container = $('#container'); 

function stringContains(string, substring) {
	// checks that string contains substring
	return string.indexOf(substring) > -1;
}

/**
 *  Selectable row in image table  
 */
/* Add a click handler for setting background color on click*/
$('#image_table tbody').on( 'click', 'tr', function () {
    $(this).toggleClass('selected');
    if ($(this).hasClass('selected')) {
    	$(this).css('background-color', 'grey');
    } else {
    	$(this).css('background-color', '');
    }
} );

/* Add a click handler for the delete row */
$('#delete_images').click( function() {
    var selectedRows = fnGetSelected( theDataTable );
    // get a list containing just the id's of selected images
    var selectedImageIdsList = jQuery.map(selectedRows, function(element) { return jQuery(element).attr('id'); });
    var selectedImageIdsJson = {"id": selectedImageIdsList};
	//delete selected images from db
    var url = deleteImagesUrl;
    $.ajax({
		url: url,
		type: "POST",
		data: selectedImageIdsJson, // serializes the form's elements.
		success: function(data) {
			console.log("images successfully deleted");
		},
		error: function(request, status, error) {
			console.log("error! ", error);
		}
	})
	
	// delete selected rows from datatable.
    for (var i = 0; i < selectedRows.length; i++) { 
        theDataTable.fnDeleteRow(selectedRows[i]);
    }
	app.vent.trigger("mapSearch:found", theDataTable.fnGetData());
} );

/* Get the rows which are currently selected */
function fnGetSelected( table ) {
    return table.$('tr.selected');
}


/*
 * Event binders
 */
/**
 * Toggles on additional information of the image when 'more info' button is clicked.
 */
function onToggle(template) {
	template.find("#info_tab").click({view: toggleView}, function(event) {
	    event.preventDefault();
	    template.find("#notes_content").hide();
	    template.find("#more_info_view").show();
	});
	template.find("#notes_tab").click({view: toggleView}, function(event) {
	    event.preventDefault();
	    template.find("#more_info_view").hide();
	    template.find("#notes_content").show();
	});

}

/**
 * Saves image info to the db when user updates it and submits.
 */
function onUpdateImageInfo(template) {
	template.find("#more_info_view").find("#more_info_form").submit(function(event) {
		event.preventDefault(); 	// avoid to execute the actual submit of the form.
		var url = updateImageUrl; // the script where you handle the form input.
		var postData = $("#more_info_form").serialize();
		$.ajax({
			url: url,
			type: "POST",
			data: postData, // serializes the form's elements.
			success: function(data)
			{
				setSaveStatusMessage($('#message'), data['status'], data['message']);

			},
			error: function(request, status, error) {
				setSaveStatusMessage($('#message'), status, error);
			}
		});
		return false; 
	});
}


/* 
 * Image next and previous button stuff
 */

/**
 * Helper that finds index in imageSetsArray
 * of the currently displayed image in the imageView.
 */
function getCurrentImageAndIndex(template) {
	// get the img's name.
	var currentImgUrl = template.find("img").attr('src');
	var currentImgIndex = null;
	// find the index of the current img
	for (var i = 0; i < imageSetsArray.length; i++) {
		if (imageSetsArray[i]['raw_image_url'] == currentImgUrl) {
			currentImgIndex = i;
			break;
		}
	}
	return currentImgIndex;
}

/**
 * Helper that updates the the image view info.
 */
function updateImageView(template, index) {
	if (index != null) {
		var imageJson = imageSetsArray[index];
		// update image name
		template.find(".image-name strong").text(imageJson['name'])
		// update image display
		template.find('img').attr('src', imageJson['raw_image_url']);
		// update image info 
		
	}
}

function hideImageNextPrev() {
   $('.prev-button').hide();
   $('.next-button').hide();
}

function onImageNextOrPrev(template) {
	template.find('.prev-button').click(function(event) {
		// set the img src
		var index = getCurrentImageAndIndex(template);
		if (index != null) {
			if (index == 0) {
				index = imageSetsArray.length -1;
			} else {
				index = index - 1;
			}
			updateImageView(template, index);
		}
	});
	template.find(".next-button").click(function(event) {
		var index = getCurrentImageAndIndex(template);
		if (index == (imageSetsArray.length - 1)) {
			index = 0;
		} else {
			index = index + 1;
		}
		updateImageView(template, index);
	});
}

/*
 * Construct the image view item
 */
function constructImageView(json, viewPage) {
    	viewPage = typeof viewPage !== 'undefined' ? viewPage : false;
	var rawTemplate = $('#template-image-view').html();
	var compiledTemplate = Handlebars.compile(rawTemplate);
	// append additional fields to json object to pass to handlebar
	json.imageName = json['name'];
	json.imagePath = json['raw_image_url'];
	// inject new fields into the precompiled template
	var newDiv = compiledTemplate(json);
	var imageViewTemplate = $(newDiv);
	// callbacks
	onUpdateImageInfo(imageViewTemplate);
	if (!viewPage){
	    onToggle(imageViewTemplate);
	    onDelete(imageViewTemplate);
	    onImageNextOrPrev(imageViewTemplate);
	}
	// append the div to the container and packery.
	var newEl;
	if (!viewPage){
	    newEl = $container.append(imageViewTemplate);
	} else {
	    newEl = $container.prepend(imageViewTemplate);
	}
	if (!viewPage){
	    newEl.find(".pinDiv").click(function(event){clickPinFunction(event)});
	    $container.packery( 'appended', imageViewTemplate);
	    makeChildrenResizable($container, imageViewTemplate);
	}
}

function setSaveStatusMessage(handler, status, msg){
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

