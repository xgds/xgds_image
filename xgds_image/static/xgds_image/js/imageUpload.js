var $container = $('#container'); 
var _imageViewIndex = 0;
bindLockItemBtnCallback($container);


/**
 * Helpers
 */

function stringContains(string, substring) {
	// checks that string contains substring
	return string.indexOf(substring) > -1;
}

function bindDeleteBtnCallback(htmlSnippet) {
	htmlSnippet.find(".icon-cancel-circled").bind("click", function() {
		// remove clicked element
		$container.packery( 'remove', event.target.parentElement.parentElement );
		// layout remaining item elements
		$container.packery();
	});	
}

function bindToggleBtnCallback(htmlSnippet) {
	var toggleView = htmlSnippet.find("#more_info_view");
	htmlSnippet.find("#image_view").find("#more_info_button").click({view: toggleView}, function(event) {
		event.data.view.slideToggle();
	});
}

function updateImageInfo(htmlSnippet) {
	// avoid to execute the actual submit of the form.
	htmlSnippet.find("#more_info_view").find("#more_info_form").submit(function(event) {
		event.preventDefault();
		// call back on submit
		updateImageInfoInDb();
		// show message that save was successful
	});
}

function bindLockItemBtnCallback(htmlSnippet) {
	htmlSnippet.find(".icon-key").bind("click", function() {
		var key = event.target;
		if (stringContains(key.parentElement.className, "item")) {
			$stamp = key.parentElement;
		} else {
			$stamp = key.parentElement.parentElement;
		}
		
		var isStamped = $stamp.getAttribute('data-isStamped');
		if ( isStamped == "true") {
			$container.packery( 'unstamp', $stamp );
			$stamp.setAttribute('data-isStamped', 'false');
			this.style.color = "silver";
		} else {
			$container.packery( 'stamp', $stamp );
			$stamp.setAttribute('data-isStamped', 'true');
			this.style.color = "grey";
		}
		$container.packery();
	});
}

/*
 * Image View
 */
function imageView(json) {
	var rawTemplate = $('#template-image-view').html();
	var compiledTemplate = Handlebars.compile(rawTemplate);
	// append additional fields to json object to pass to handlebar
	json.imageName = json['imageName'];
	json.imagePath = json['imageUrl'];
	json.allAuthors = allAuthors;
	json.allSources = allSources;
	// inject new fields into the precompiled template
	var htmlString = compiledTemplate(json);
	var newDiv = $(htmlString);
	// call backs
	bindToggleBtnCallback(newDiv);
	updateImageInfo(newDiv);
	bindDeleteBtnCallback(newDiv);
	bindLockItemBtnCallback(newDiv);
	// append the div to the container.
	var result = $container.append(newDiv);
	$container.packery( 'appended', newDiv);
	makeChildrenResizable($container, newDiv);
	_imageViewIndex = _imageViewIndex + 1;
}


//update image data
function updateImageInfoInDb(){
	var url = "/xgds_image/updateImageInfo/"; // the script where you handle the form input.
	var postData = $("#more_info_form").serializeArray();
	$.ajax({
		url: url,
		type: "POST",
		dataType: 'json',
		data: postData, // serializes the form's elements.
		success: function(data)
		{
			// display success message
			$('#message').addClass('success-message');
			$('#message').text("Save successful");	
		},
		error: function() {
			$('#message').addClass('error-message');
			$('#message').text("Error: Save failed");
		}
	});
	return false; 
}

/* 
 * Table View
 */
// initialize the image table with json of existing images.
var imageTable = $('#image_table'); 
defaultOptions["aaData"] = imageJson;
defaultOptions["aoColumns"] = [
                               {"mRender":function(data, type, full){
                            	   var imageName = full['imageName'];
                            	   var jsonString = JSON.stringify(full);
                                   return "<a onclick='imageView(" + jsonString + ")'>"+ imageName +"</a>";
                               }},
                               {"mData": "creation_time"},
                               {"mData": "source"},
                               {"mData": "latitude"},
                               {"mData": "longitude"},
                               {"mData": "altitude"}
];

if ( ! $.fn.DataTable.isDataTable( '#image_table' ) ) {
	  $('#image_table').DataTable(defaultOptions);
}


/*
 * Image drag and drop upload
 */
Dropzone.options.imageDropZone = {
	// Prevents Dropzone from uploading dropped files immediately
	autoProcessQueue : false,
	//	acceptedFiles: 'application/image',
	init : function() {
		var submitButton = document.querySelector("#submit-all")
		imageDropZone = this;

		submitButton.addEventListener("click", function() {
			imageDropZone.processQueue();  // Tell Dropzone to process all queued files.
		});

		// You might want to show the submit button only when
		// files are dropped here:
		this.on("addedfile", function() {
			// Show submit button here and/or inform user to click it.
		});
		
		this.on("success", function(file, responseText, e) {
			var json = responseText['json'];
			imageTable.dataTable().fnAddData(json);
		});
	}
};