var $container = $('#container'); 

// images table
defaultOptions["columnDefs"] = [{ "width": "150", "targets": 0 }];
var imageTable = $('#image_table').DataTable(defaultOptions);

// give path, construct an html link
function createLink(path) {
	return "<a href='javascript:imageView(\"" + path + "\");'>" + path + "</a>";
}

// call back for onclick that creates a new div with image view
function imageView(imagePath) {
	/**
	 * If the view doesn't exist, create one. 
	 */
	//create a div that displays this imageView
	var elem = document.createElement('div');
	elem.className='item w_image lockAspect';
	elem.id='item_image_view';
	$('<img src="'+ imagePath +'">').width(450).height('auto').appendTo(elem);
	//append to container
	$container.append( elem );
	$container.packery('appended', elem);
	
	// layout Packery after all images have loaded
	$container.imagesLoaded( function() {
	  $container.packery();
	});
}

// add rows to the table on page load.
$(images).each(function(){
	var imageUrl = createLink(this['imageUrl']);
	imageTable.row.add([imageUrl, this['creation_time'], 'dummy source', 
	                    'dummy lat', 'dummy lon', 'dummy alt']).draw();
});

// image dropzone
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
			imageJson = responseText['json'];
			var imageUrl = createLink(imageJson['imageUrl']);
			imageTable.row.add([imageUrl, imageJson['creation_time'], 'dummy source', 
			                    'dummy lat', 'dummy lon', 'dummy alt']).draw();
		});
	}
};