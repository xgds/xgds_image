var $container = $('#container'); 
var _imageViewIndex = 0;

/**
 * Helpers
 */
function deleteButton() {
	$('.icon-cancel-circled').bind("click", function() {
		// remove clicked element
		$container.packery( 'remove', event.target.parentElement );
		// layout remaining item elements
		$container.packery();
	});	
}


/*
 * Image View
 */
function imageView(json) {
	var imagePath = json['imageUrl'];
	var imageName = imagePath.split('/').slice(-1)[0];
	var rawTemplate = $('#template-image-view').html();
	var compiledTemplate = Handlebars.compile(rawTemplate);
	var jsonList = {imageName : imageName, 
					imagePath: imagePath, 
					imageId: json['imageId'],
					source: json['source'],
					time: json['creation_time'],
					latitude: json['latitude'],
					longitude: json['longitude'],
					altitude: json['altitude'],
					author: json['author'],
					allAuthors: allAuthors,
					allSources: allSources, 
					imageViewIndex: _imageViewIndex
					};
	var htmlString = compiledTemplate(jsonList);
	var newDiv = $(htmlString);
	$container.append(newDiv);
	$container.packery( 'appended', newDiv);
	makeChildrenResizable($container, newDiv);
	// bind the button to callback
	$( "#more_info_button_" + _imageViewIndex ).click(function() {
		  $( "#more_info_view_" + _imageViewIndex ).slideToggle( "slow" );
	});
	_imageViewIndex = _imageViewIndex + 1;
}


//update image data
function updateImageInfo(){
	var url = "/xgds_image/updateImageInfo/"; // the script where you handle the form input.
	var postData = $("#more_info_form").serializeArray();
	$.ajax({
		url: url,
		type: "POST",
		dataType: 'json',
		data: postData, // serializes the form's elements.
		success: function(data)
		{
			console.log("image successfully updated");
		},
		error: function() {
			alert("failed!");
		}
	});
	return false; // avoid to execute the actual submit of the form.
}

/* 
 * Table View
 */
// initialize the image table with json of existing images.
var imageTable = $('#image_table'); 
defaultOptions["aaData"] = imageJson;
defaultOptions["aoColumns"] = [
                               {"mRender":function(data, type, full){
                            	   var imageName = full['imageUrl'].split('/').slice(-1)[0];
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