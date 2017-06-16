(function(Binder) {
	var context = {
		attachPoints: {
			detailsNode: document.getElementById('inplace-contact-details'),
			listNode: document.getElementById('contacts-list')
		},
		selected: null,
		currentlyEditing: null,
		restoreObject: null,
		startEditing: function(contact) {
			this.currentlyEditing = contact;
			this.restoreObject = Object.assign({}, contact);
			this.attachPoints.detailsNode.classList.add('editing');
		},
		cancelEditing: function() {
			// if we were editing - restore the object...
			if (this.currentlyEditing && this.restoreObject) {
				this.contactProxyHandler.startMassPropertyUpdating(this.currentlyEditing);
				Object.assign(this.currentlyEditing, this.restoreObject);
				this.contactProxyHandler.endMassPropertyUpdating(this.currentlyEditing);
			}
			this.currentlyEditing = null;
			this.attachPoints.detailsNode.classList.remove('editing');
			binders.mainDisplay.rebind();
		},
		saveEditing: function() {
			this.currentlyEditing = null;
			this.attachPoints.detailsNode.classList.remove('editing');
			binders.mainDisplay.rebind();
		},
		deleteContact: function(contact) {
			// find in list...
			var contactListNode = this.attachPoints.listNode.querySelector('#contact-' + contact.id);
			if (contactListNode) {
				var selectNewContact = contactListNode.nextElementSibling;
				if (!selectNewContact) {
					selectNewContact = contactListNode.previousElementSibling;
				}
				this.attachPoints.listNode.removeChild(contactListNode);
				selectNewContact.click();
			}
		},
		contactProxyHandler: {
			massUpdatesCache: {},
			startMassPropertyUpdating: function(obj) {
				this.massUpdatesCache[obj.id] = obj;
			},
			endMassPropertyUpdating: function(obj) {
				if (this.massUpdatesCache.hasOwnProperty(obj.id)) {
					this.doRebindings(obj);
				}
				delete this.massUpdatesCache[obj.id];
			},
			doRebindings: function(obj) {
				if (obj.hasOwnProperty('rebindings')) {
					for (var r = 0, rmax = obj.rebindings.length; r < rmax; r++) {
						obj.rebindings[r].binder.rebind(obj, obj.rebindings[r].node);
					}
				}
			},
			set: function(obj, pty, value) {
				// store property in underlying object...
				obj[pty] = value;
				// if we're not doing a mass property update, then rebind the data to any of its existing bindings...
				if (!this.massUpdatesCache.hasOwnProperty(obj.id)) {
					this.doRebindings(obj.$proxy);
				}
				// successful...
				return true;
			}
		}
	};
	var binders = {
		'mainDisplay': new Binder(context.attachPoints.detailsNode, {
			'.inplace-email': function(contact) {
				return contact.emailAddress || '[Unspecified]';
			},
			'.inplace-given-name': function(contact) {
				return contact.givenName || '[Unspecified]';
			},
			'.inplace-family-name': function(contact) {
				return contact.familyName || '[Unspecified]';
			},
			'.inplace-title': function(contact) {
				return contact.title || '[Unspecified]';
			},
			'.inplace-salutation': '{{title}} {{givenName}} {{familyName}}',
			'.inplace-gender': 'gender',
			'#button-edit-details @event.click': function(evt, boundNode, eventNode, contact) {
				this.startEditing(contact);
			},
			'#button-cancel-edit @event.click': function(evt, boundNode, eventNode, contact) {
				this.cancelEditing();
			},
			'#button-save @event.click': function(evt, boundNode, eventNode, contact) {
				this.saveEditing();
			},
			'#button-delete @event.click': function(evt, boundNode, eventNode, contact) {
				this.deleteContact(contact);
			},
			'#input-email': {
				'@pty.value': function(contact) {
					return contact.emailAddress || '';
				},
				'@event.input': function(evt, boundNode, eventNode, contact) {
					contact.emailAddress = eventNode.value;
					binders.mainDisplay.rebind();
				}
			},
			'#input-title': {
				'@pty.value': function(contact) {
					return contact.title || '';
				},
				'@event.input': function(evt, boundNode, eventNode, contact) {
					contact.title = eventNode.value;
					binders.mainDisplay.rebind();
				}
			},
			'#input-given-name': {
				'@pty.value': function(contact) {
					return contact.givenName || '';
				},
				'@event.input': function(evt, boundNode, eventNode, contact) {
					contact.givenName = eventNode.value;
					binders.mainDisplay.rebind();
				}
			},
			'#input-family-name': {
				'@pty.value': function(contact) {
					return contact.familyName || '';
				},
				'@event.input': function(evt, boundNode, eventNode, contact) {
					contact.familyName = eventNode.value;
					binders.mainDisplay.rebind();
				}
			},
			'#input-gender': {
				'@pty.selectedIndex': function(contact) {
					return ['male','female','unspecified'].indexOf(contact.gender);
				},
				'@event.input': function(evt, boundNode, eventNode, contact) {
					contact.gender = ['male','female','unspecified'][eventNode.selectedIndex];
					binders.mainDisplay.rebind();
				}
			}
		}, context, true),
		'listItem': new Binder(document.getElementById('list-item-template'), {
			'@id': 'contact-{{id}}',
			'@href': '#selected={{id}}',
			'@class.add': function(contact) {
				if (contact.id === this.selected) {
					return 'selected';
				}
			},
			'@tabindex': function(contact) {
				return (contact.id === this.selected ? '1' : '0');
			},
			'.gender @class.add': 'gender',
			'.main-detail': '{{title}} {{givenName}} {{familyName}}',
			'.sub-detail': 'emailAddress'
		}, context)
	};
	var contacts = [
		{
			id: 1,
			emailAddress: 'Martin.Rowlinson@foo.com',
			givenName: 'Martin',
			familyName: 'Rowlinson',
			title: 'Mr.',
			gender: 'male'
		},
		{
			id: 2,
			emailAddress: 'Carolina.Madore@foo.com',
			givenName: 'Carolina',
			familyName: 'Madore',
			title: 'Ms.',
			gender: 'female'
		},
		{
			id: 3,
			emailAddress: 'Pamela.Minott@foo.com',
			givenName: 'Pamela',
			familyName: 'Minott',
			title: 'Miss',
			gender: 'female'
		},
		{
			id: 4,
			emailAddress: 'Madelaine.Biscoe@foo.com',
			givenName: 'Madelaine',
			familyName: 'Biscoe',
			title: 'Mrs',
			gender: 'female'
		},
		{
			id: 5,
			emailAddress: 'Carlos.Graziano@foo.com',
			givenName: 'Carlos',
			familyName: 'Graziano',
			title: 'Dr.',
			gender: 'male'
		},
		{
			id: 6,
			emailAddress: 'Cameron.Drost@foo.com',
			givenName: 'Cameron',
			familyName: 'Drost',
			title: 'Mr.',
			gender: 'male'
		},
		{
			id: 7,
			emailAddress: 'Delma.Venegas@foo.com',
			givenName: 'Delma',
			familyName: 'Venegas',
			title: 'Miss',
			gender: 'female'
		},
		{
			id: 8,
			emailAddress: 'Amina.Peeler@foo.com',
			givenName: 'Amina',
			familyName: 'Peeler',
			title: 'Mrs.',
			gender: 'female'
		},
		{
			id: 9,
			emailAddress: 'Dorothy.Koeppel@foo.com',
			givenName: 'Dorothy',
			familyName: 'Koeppel',
			title: 'Mrs.',
			gender: 'female'
		},
		{
			id: 10,
			emailAddress: 'Eleanore.Speciale@foo.com',
			givenName: 'Eleanore',
			familyName: 'Speciale',
			title: 'Mrs.',
			gender: 'female'
		},
		{
			id: 11,
			emailAddress: 'Valarie.Nebeker@foo.com',
			givenName: 'Valarie',
			familyName: 'Nebeker',
			title: 'Miss',
			gender: 'female'
		},
		{
			id: 12,
			emailAddress: 'Eloise.Taniguchi@foo.com',
			givenName: 'Eloise',
			familyName: 'Taniguchi',
			title: 'Ms',
			gender: 'female'
		},
		{
			id: 13,
			emailAddress: 'Alejandro.Eyre@foo.com',
			givenName: 'Alejandro',
			familyName: 'Eyre',
			title: 'Mr.',
			gender: 'male'
		},
		{
			id: 14,
			emailAddress: 'Rozanne.Schleusner@foo.com',
			givenName: 'Rozanne',
			familyName: 'Schleusner',
			title: 'Miss',
			gender: 'female'
		},
		{
			id: 15,
			emailAddress: 'Kirsten.Gaydos@foo.com',
			givenName: 'Kirsten',
			familyName: 'Gaydos',
			title: 'Miss',
			gender: 'female'
		},
		{
			id: 16,
			emailAddress: 'Charles.Petters@foo.com',
			givenName: 'Charles',
			familyName: 'Petters',
			title: 'Mr.',
			gender: 'male'
		},
		{
			id: 17,
			emailAddress: 'Lang.Eller@foo.com',
			givenName: 'Lang',
			familyName: 'Eller',
			title: 'Prof.',
			gender: 'unspecified'
		},
		{
			id: 18,
			emailAddress: 'Milo.Orvis@foo.com',
			givenName: 'Milo',
			familyName: 'Orvis',
			title: 'Mr.',
			gender: 'male'
		},
		{
			id: 19,
			emailAddress: 'Wynona.Bohn@foo.com',
			givenName: 'Wynona',
			familyName: 'Bohn',
			title: 'Mrs.',
			gender: 'female'
		},
		{
			id: 20,
			emailAddress: 'Billie.Ensley@foo.com',
			givenName: 'Billie',
			familyName: 'Ensley',
			title: 'Mr.',
			gender: 'male'
		}
	];
	// sort our contacts...
	contacts.sort(function(a, b) {
		var result = a.familyName.localeCompare(b.familyName);
		if (result === 0) {
			result = a.givenName.localeCompare(b.givenName);
		}
		return result;
	});
	// get the current selected from initial hash...
	var initialHash = getHashObject();
	context.selected = parseInt(initialHash.selected);
	var foundInitialItem = false;
	var initialNode;
	// populate the list...
	var list = document.getElementById('contacts-list');
	for (var i = 0, imax = contacts.length; i < imax; i++) {
		contacts[i].rebindings = [];
		contacts[i].$proxy = new Proxy(contacts[i], context.contactProxyHandler);
		contacts[i] = contacts[i].$proxy;
		var listNode = binders.listItem.bind(contacts[i]);
		contacts[i].rebindings.push({
			node: listNode,
			binder: binders.listItem
		});
		if (contacts[i].id === context.selected) {
			foundInitialItem = true;
			initialNode = listNode;
		}
		context.attachPoints.listNode.appendChild(listNode);
	}
	if (!foundInitialItem) {
		doSelectedChange(contacts[0].id);
	} else {
		showMainSelected(initialNode);
		makeListItemVisible(initialNode);
	}
	// hookup window hash change...
	window.addEventListener('hashchange', onHashChange);

	function onHashChange(evt) {
		var newHashState = getHashObject();
		doSelectedChange(newHashState.selected);
	}

	function doSelectedChange(newSelectedId) {
		if (parseInt(newSelectedId) !== context.selected) {
			context.selected = parseInt(newSelectedId);
			// de-select the current...
			var currentSelectedNodes = context.attachPoints.listNode.querySelectorAll('.list-item.selected');
			for (var i = 0, imax = currentSelectedNodes.length; i < imax; i++) {
				currentSelectedNodes[i].classList.remove('selected');
				currentSelectedNodes[i].setAttribute('tabindex', '0');
			}
			var newlySelectedNode = context.attachPoints.listNode.querySelector('#contact-' + context.selected);
			if (!newlySelectedNode) {
				context.selected = contacts[0].id;
				newlySelectedNode = context.attachPoints.listNode.querySelector('#contact-' + context.selected);
			}
			if (newlySelectedNode) {
				newlySelectedNode.classList.add('selected');
				newlySelectedNode.setAttribute('tabindex', '1');
				makeListItemVisible(newlySelectedNode);
				showMainSelected(newlySelectedNode)
			}
			context.cancelEditing();
		}
	}

	function showMainSelected(selectedNode) {
		binders.mainDisplay.bind(binders.listItem.getBoundData(selectedNode));
	}

	function makeListItemVisible(listItemNode) {
		var rect = listItemNode.getBoundingClientRect();
		var list = context.attachPoints.listNode;
		var listRect = list.getBoundingClientRect();
		var actualTop = (rect.top - listRect.top) + list.scrollTop;
		if (actualTop < list.scrollTop || (actualTop + rect.height) > (list.scrollTop + listRect.height)) {
			list.scrollTop = actualTop;
		}
	}

	function getHashObject() {
		var result = {};
		var hash = window.location.hash;
		var useHash = (hash.substr(0,1) === '#' ? hash.substr(1) : hash); // some browsers prefix with '#' (which we don't want)
		var params = useHash.split('&');
		var paramParts;
		for (var p = 0, pmax = params.length; p < pmax; p++) {
			paramParts = params[p].split('=');
			if (paramParts.length > 1) {
				result[paramParts[0]] = paramParts[1];
			} else {
				result[paramParts[0]] = null;
			}
		}
		return result;
	}

})(window.Binder);
