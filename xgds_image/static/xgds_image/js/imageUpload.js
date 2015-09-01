var $container = $('#container'); 

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
	var raw_template = $('#template-image-view').html();
	var compiledTemplate = Handlebars.compile(raw_template);
	var htmlString = compiledTemplate({ imageName : imageName, 
								  imagePath: imagePath});

	newDiv = $(htmlString);
	$container.append(newDiv);
	$container.packery( 'appended', newDiv);
	makeChildrenResizable($container, newDiv);
	deleteButton();
}


/*
 * More Info View
 */
function moreInfoView(json, imageName) {	
	var raw_template = $('#template-moreinfo-view').html();
	var compiledTemplate = Handlebars.compile(raw_template);
	var html = compiledTemplate({imageName: imageName});
	$container.append(html);
	$container.packery();
	makeResizable($container);
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