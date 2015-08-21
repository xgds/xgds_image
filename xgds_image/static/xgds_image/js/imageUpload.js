var $container = $('#container'); 

// images table
defaultOptions["columnDefs"] = [{ "width": "150", "targets": 0 }];
var imageTable = $('#image_table').DataTable(defaultOptions);

// give path, construct an html link
function createLink(path) {
	var imgName = path.split('/');
	imgName = imgName[imgName.length-1];
	return "<a href='javascript:imageView(\"" + imgName + "\",\"" + path + "\");'>" + imgName + "</a>";
}

// call back for onclick that creates a new div with image view
function imageView(imageName, imagePath) {
	/**
	 * If the view doesn't exist, create one. 
	 */
	//create a div that displays this imageView
	var elem = document.createElement('div');
	elem.className='item w_image lockAspect';
	elem.id='item_image_view';
	elem.innerHTML = "<strong>"+imageName+"</strong>";
	$('<img src="'+ imagePath +'">').width(450).height(300).appendTo(elem);
	
	//image description
	var descriptionDiv = document.createElement('div');
	descriptionDiv.innerHTML = "Source: dummy source, Author: Jane Doe, Altitude: 5800ft";
	elem.appendChild(descriptionDiv);
	
	//more info html link
	var a = document.createElement('a');
	a.href =  'javascript:moreInfo();'; // Insted of calling setAttribute 
	a.innerHTML = 'More info' // <a>INNER_TEXT</a>
	elem.appendChild(a);
	
	//append to container
	$container.append( elem );
	$container.packery('appended', elem);

	// call make resizeable again
	makeResizable($container);
}

// callback for creating a more info view 
function moreInfo() {
	alert("more info view");
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