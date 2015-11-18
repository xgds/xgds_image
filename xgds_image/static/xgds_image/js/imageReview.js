var $container = $('#container'); 

function stringContains(string, substring) {
	// checks that string contains substring
	return string.indexOf(substring) > -1;
}

/*
 * Event binders
 */
/**
 * Removes packery item upon delete button click.
 */
function onDelete(template) {
	template.find(".icon-cancel-circled").bind("click", function() {
		// remove clicked element
		$container.packery( 'remove', event.target.parentElement.parentElement );
		// layout remaining item elements
		$container.packery();
	});	
}

/**
 * Toggles on additional information of the image when 'more info' button is clicked.
 */
function onToggle(template) {
	var toggleView = template.find("#more_info_view");
	template.find("#image_view").find("#more_info_button").click({view: toggleView}, function(event) {
		event.data.view.slideToggle();
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
function constructImageView(json) {
	var rawTemplate = $('#template-image-view').html();
	var compiledTemplate = Handlebars.compile(rawTemplate);
	// append additional fields to json object to pass to handlebar
	json.imageName = json['name'];
	json.imagePath = json['raw_image_url'];
	// inject new fields into the precompiled template
	var newDiv = compiledTemplate(json);
	var imageViewTemplate = $(newDiv);
	// call backs
	onUpdateImageInfo(imageViewTemplate);
	onToggle(imageViewTemplate);
	onDelete(imageViewTemplate);
	bindLockItemBtnCallback(imageViewTemplate);
	onImageNextOrPrev(imageViewTemplate);
	// append the div to the container.
	var result = $container.append(imageViewTemplate);
	$container.packery( 'appended', imageViewTemplate);
	makeChildrenResizable($container, imageViewTemplate);
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


/* 
 * Table View
 */
function setupTable(){
	// initialize the image table with json of existing images.
	defaultOptions["aaData"] = imageSetsArray;
	defaultOptions["aoColumns"] = [
	                               {"mRender": function(data, type, full) {
	                            	   return "<img src='"+full['thumbnail_image_url']+"' width='130'></img>"
	                               }},
	                               {"mRender":function(data, type, full){
	                            	   var imageName = full['name'];
	                            	   var jsonString = JSON.stringify(full);
	                                   return "<a onclick='constructImageView(" + jsonString + ")'>"+ imageName +"</a>";
	                               }},
	                               {"mData": "camera_name"},
	                               {"mData": "creation_time"},
	                               {"mData": "lat"},
	                               {"mData": "lon"},
	                               {"mData": "altitude"},
	                               {"mData": "author_name"},
	];

	if ( ! $.fn.DataTable.isDataTable( '#image_table' ) ) {
		  theDataTable = $('#image_table').dataTable(defaultOptions);
	}
}

