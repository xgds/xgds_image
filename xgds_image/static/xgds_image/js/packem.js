function initializePackery() {
    //update  sizing
    var $container = $('#container');
    $container.packery({
	itemSelector: '.item',
	gutter: 10
    });
    makeResizable($container);
    bindLockItemBtnCallback($container);
    $container.packery('bindResize');
}

function makeResizable($container) {
    // get item elements, jQuery-ify them
    var $itemElems = $( $container.packery('getItemElements') );
    makeChildrenResizable($container, $itemElems);
}

function makeChildrenResizable($container, $itemElems){
    // make each of the items resizable
    $itemElems.each(function(index, element) {
	var el = $(element);
	var lockAspect = el.hasClass("lockAspect");
	el.draggable();
	if (!el.hasClass("noresize")){
	    el.resizable({
		aspectRatio: lockAspect
	    });
	}
	if (el.hasClass("startPinned")) {
	    pinItem($container, el, el.find(".pinDiv"));
	}
    })
    
    // bind Draggable events to Packery
    $container.packery( 'bindUIDraggableEvents', $itemElems );

    // handle resizing
    var resizeTimeout;
    $itemElems.on( 'resize', function( event, ui ) {
	// debounce
	if ( resizeTimeout ) {
	    clearTimeout( resizeTimeout );
	}

	resizeTimeout = setTimeout( function() {
	    $container.packery( 'fit', ui.element[0] );
	}, 100 );
    });
}

function pinItem(container, item, pinButton){
    // pin it -- not draggable or resizable
    item.draggable("disable");
    if (!item.hasClass("noresize")){
	item.resizable("disable");
    }
    pinButton.removeClass('icon-lock-open');
    pinButton.addClass('icon-lock');
    $container.packery( 'stamp', item );
}

function unpinItem(container, item, pinButton){
 // unpin it, make it draggable and resizable
    item.draggable( "enable" );
    if (!item.hasClass("noresize")){
	item.resizable("enable");
    }
    pinButton.removeClass('icon-lock');
    pinButton.addClass('icon-lock-open');
    $container.packery( 'unstamp', item );
}

clickPinFunction = function(event) {
    var pinButton = $(event.target);
    var item = pinButton.closest(".item");
    var $container = $('#container');
    
    if (pinButton.hasClass('icon-lock')) {
	unpinItem($container, item, pinButton);
    } else {
	pinItem($container, item, pinButton);
    }
}

/**
 * Locks/unlocks the packery template when user clicks on the key icon.
 */
function bindLockItemBtnCallback($container) {
    $(".pinDiv").click(function(event) {
	clickPinFunction(event);
    });
}
