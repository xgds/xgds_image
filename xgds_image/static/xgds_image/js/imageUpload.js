var $container = $('#container'); 

/**
 * Helpers
 */
$('i').bind("click", function() {
	// remove clicked element
	$container.packery( 'remove', event.target.parentElement );
	// layout remaining item elements
	$container.packery();
});

/*
 * Image View
 */
function imageView(imageName, imagePath) {	
	var raw_template = $('#template-image-view').html();
	var template = Handlebars.compile(raw_template);
	$container.append(template);
	makeResizable($container);
	// trigger layout
	$container.packery();
	
}

/*
 * More Info View
 */
function moreInfoView(imageName) {	
	var raw_template = $('#template-moreinfo-view').html();
	var template = Handlebars.compile(raw_template);
	$container.append(template);
	$container.packery();
	makeResizable($container);
}

/* 
 * Table View
 */
//images table
defaultOptions["columnDefs"] = [{ "width": "150", "targets": 0 }];
var imageTable = $('#image_table').DataTable(defaultOptions);

// give path, construct an html link
function createLink(path) {
	var imgName = path.split('/');
	imgName = imgName[imgName.length-1];
	return "<a href='javascript:imageView(\"" + imgName + "\",\"" + path + "\");'>" + imgName + "</a>";
}

// add rows to the table on page load.
$(images).each(function(){
	var imageUrl = createLink(this['imageUrl']);
	imageTable.row.add([imageUrl, this['creation_time'], 'dummy source', 
	                    'dummy lat', 'dummy lon', 'dummy alt']).draw();
});


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
			imageJson = responseText['json'];
			var imageUrl = createLink(imageJson['imageUrl']);
			// TODO: get rid of dummies and pull from backend
			imageTable.row.add([imageUrl, imageJson['creation_time'], 'dummy source', 
			                    'dummy lat', 'dummy lon', 'dummy alt']).draw();
		});
	}
};