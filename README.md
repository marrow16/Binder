# Binder

A pure Javascript template data binder - with high performance and easy to use CSS selector style syntax.

Creating a new binder (using HTML string):
```javascript
var myBinder = new Binder('<a></a>', {
    '@id': 'item-link-{{uid}}',
    '@href': '/items/{{uid}}',
    '#textContent': 'name'
});
```
As above, when constructing a binder, the first argument is the HTML template (either as a string or an exsiting node from the DOM).  The second argument is the actual bindings - an object where the property names are a CSS selector to indentify the node/attribute to be populated and the property values are the binding instruction of what to bind... how to construct the value to be be inserted into the generated HTML. 

and then to use the binder to generate a new node:
```javascript
var newNode = myBinder.bind({
    'uid': '27e7a5284dee',
    'name': 'My first item'
});
```
would produce a node with the following HTML:
```html
<a id="item-link-27e7a5284dee" href="/items/27e7a5284dee">My first item</a>
```

<br/>

## Table of Contents

* <strong><a href="#constructor">Constructor</a></strong>
* <strong><a href="#methods">Methods</a></strong>
    * <a href="#bind">bind</a>
    * <a href="#rebind">rebind</a>
    * <a href="#getbounddata">getBoundData</a>
    * <a href="#isinplace">isInplace</a>
* <strong><a href="#binding-selectors">Binding Selectors</a></strong>
    * <a href="#nested-binding-selectors">Nested Binding Selectors</a>
* <strong><a href="#binding-instructions">Binding Instructions</a></strong>
* <strong><a href="#binding-instructions-function-scope">Binding Instructions Function Scope</a></strong>
* <strong><a href="#cookie-cutter-mode--in-place-mode">Cookie-cutter mode & In-place mode</a></strong>
* <strong><a href="#examples">Examples</a></strong>
* <strong><a href="#how-it-works">How It Works</a></strong>
* <strong><a href="#browser-compatibility">Browser Compatibility</a></strong>

<br/>

## Constructor
<table width="100%">
    <tr>
        <td colspan="3">
            <code>new Binder(template, bindings[, bindingsScope [, inplaceMode[, [options]]])</code>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <th>
            Parameter
        </th>
        <th>
            Type
        </th>
        <th>
            Description
        </th>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <code>template</code>
        </td>
        <td valign="top">
            string | node 
        </td>
        <td>
            The template node or template HTML string.<br/><br/>
            For <a href="#cookie-cutter-mode--in-place-mode">cookie-cutter mode</a>, the <code>template</code> argument can be a string or existing DOM node (including a HTML <code>&lt;template&gt;</code> element)<br/><br/>
            For <a href="#cookie-cutter-mode--in-place-mode">in-place mode</a>, the <code>template</code> argument <strong>must</strong> be an existing DOM element (and <strong>cannot</strong> be a HTML <code>&lt;template&gt;</code> element).<br/>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <code>bindings</code>
        </td>
        <td valign="top">
            object 
        </td>
        <td>
            An object containing the bindings - where the property names are the <a href="#binding-selectors">binding selectors</a> and the property values are the <a href="#binding-instructions">binding instructions</s>.
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <code>bindingScope</code>
        </td>
        <td valign="top">
            object 
        </td>
        <td>
            [optional] An object to be used as the <a href="#binding-instructions-function-scope">binding instructions function scope</a>.
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <code>inplaceMode</code>
        </td>
        <td valign="top">
            boolean 
        </td>
        <td>
            [optional] Flag indicating whether the binder is created as <a href="#cookie-cutter-mode--in-place-mode">in-place mode</a> (<code>true</code>) or <a href="#cookie-cutter-mode--in-place-mode">cookie-cutter mode</a> (<code>false</code> default).  
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <code>options</code>
        </td>
        <td valign="top">
            object 
        </td>
        <td>
            [optional] An object containing additional binder (debugging) options.<br/>
            The object can conatin the following boolean properties:<br/>
            <ul>
                <li><code>compileWarnings</code> - whether to compiler (constructor) shows in the console warnings about compile prroblems (default is <code>false</code>)</li>
                <li><code>bindWarnings</code> - whether, during binding, warnings are shown in the console about addressed data properties not being present (default is <code>false</code>)</li>
            </ul>
        </td>
    </tr>
</table>

<br/>

## Methods
<table>
    <tr>
        <th align="left" valign="top">
            <h4>bind</h4>
        </th>
        <td>
            <br/><em>Populates a template node with data</em><br/><br/> 
            <strong>Syntax:</strong><br/><br/>
            <code><em>binder.</em>bind(<em>data</em>) =&gt; <em>node</em></code><br/><br/>
            <strong>Parameters:</strong><br/><br/>
            <code><em>data</em></code> - an object containing the data to be bound<br/><br/>
            <strong>Returns:</strong><br/><br/>
            <code>node</code> - the node with data populated
        </td>
    </tr>
    <tr></tr>
    <tr>
        <th align="left" valign="top">
            <h4>rebind</h4>
        </th>
        <td>
            <br/><em>Re-populates an existing node with new data</em><br/> <br/>
            <strong>Syntax:</strong><br/><br/>
            <code><em>binder.</em>rebind(<em>data</em>, <em>node</em>) =&gt; <em>node</em></code><br/><br/>
            <strong>Parameters:</strong><br/><br/>
            <code><em>data</em></code> - an object containing the data to be bound<br/><br/>
            <code><em>node</em></code> - the node to be re-bound<br/><br/>
            <strong>Returns:</strong><br/><br/>
            <code>node</code> - the node with data populated
        </td>
    </tr>
    <tr></tr>
    <tr>
        <th align="left" valign="top">
            <h4>getBoundData</h4>
        </th>
        <td>
            <br/><em>Gets the currently bound data from a node</em><br/><br/> 
            <strong>Syntax:</strong><br/><br/>
            <code><em>binder.</em>getBoundData(<em>node</em>) =&gt; <em>object</em></code><br/><br/>
            <strong>Parameters:</strong><br/><br/>
            <code><em>node</em></code> - the previously bound node<br/><br/>
            <strong>Returns:</strong><br/><br/>
            <code>object</code> - the data that was bound to the node
        </td>
    </tr>
    <tr></tr>
    <tr>
        <th align="left" valign="top">
            <h4>isInplace</h4>
        </th>
        <td>
            <br/><em>Returns whether the binder was created as </em><a href="#cookie-cutter-mode--in-place-mode">cookie-cutter mode</a>
            <em> or </em> <a href="#cookie-cutter-mode--in-place-mode">in-place mode</a>.<br/><br/>
            <strong>Syntax:</strong><br/><br/>
            <code><em>binder.</em>isInplace() =&gt; <em>boolean</em></code><br/><br/>
            <strong>Returns:</strong><br/><br/>
            <code>boolean</code> - whether the binder was created as <a href="#cookie-cutter-mode--in-place-mode">in-place mode</a> (<code>true</code>) or 
            <a href="#cookie-cutter-mode--in-place-mode">cookie-cutter mode</a> (<code>false</code>)
        </td>
    </tr>
</table>

<br/>

## Binding Selectors

The binding selectors are the property names of the object passed to the binding constructor.  These property names use 'standard' CSS query syntax - as used by `.querySelectror()` or `.querySelectorAll()`.  Each specified binding selector (CSS query) **must** only select one node from the template - if more than one node within the template for the binding selector is found, the Binder constructor will throw an exception. 
 
To allow for bindings to attributes, properties and events some additional 'special' tokens can be added to the end of the binding selectors - these are:  

<table>
    <tr>
        <th>Token</th>
        <th>Description</th>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-textcontent"></a><code>#textContent</code>
        </td>
        <td>
            Sets the text content for the selected node <br/>
            This is the default for all selectors when no other special token present<br/>
            <em>(see <a href="#example-1---explict-textcontent">Example 1</a> and <a href="#example-2---implicit-textcontent">Example 2</a>)</em>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-innerhtml"></a><code>#innerHTML</code>
        </td>
        <td>
            Sets the inner HTML for the selected node<br/>
            <em>(see <a href="#example-3---innerhtml">Example 3</a>)</em>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-append"></a><code>#append</code>
        </td>
        <td>
            Appends nodes to the selected node<br/>
            <em>(see <a href="#example-4---append">Example 4</a>)</em>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-attribute-name"></a><code>@<em>attribute-name</em></code>
        </td>
        <td>
            Sets a specific named attribute on the selected node<br/>
            <em>(see <a href="#example-5---attribute-name">Example 5</a>)</em>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-attribute-name-remove"></a><code>@<em>@attribute-name</em>.remove</code>
        </td>
        <td>
            Removes a specific named atrribute from the selected node<br/>
            <em>(see <a href="#example-6---attribute-nameremove">Example 6</a>)</em>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-class-add"></a><code>@class.add</code>
        </td>
        <td>
            Adds class token(s) to the specified node<br/>
            The binding instructtion returns a string name of the class token to add or an array of string class tokiens to add<br/>
            <em>(see <a href="#example-7---classadd">Example 7</a> and <a href="#example-8---classadd-adding-multiple-classes">Example 8</a>)</em>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-class-remove"></a><code>@class.remove</code>
        </td>
        <td>
            Removes class token(s) from the specified node<br/>
            The binding instructtion returns a string name of the class token to remove or an array of string class tokiens to remove<br/>
            <em>(see <a href="#example-9---classremove">Example 9</a> and <a href="#example-10---classremove-removing-multiple-classes">Example 10</a>)</em>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-property-name"></a><code>@property.<em>property-name</em></code>
        </td>
        <td>
            Sets a specific named property on the selected node<br/>
            <em>(see <a href="#example-11---propertyproperty-name">Example 11</a>)</em>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-dataset-name"></a><code>@dataset.<em>name</em></code>
        </td>
        <td>
            Sets a specific named <code>data-</code> attribute on the selected node<br/>
            <em>(see <a href="#example-12---datasetname">Example 12</a>)</em>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-event-name"></a><code>@event.<em>event-name</em></code>
        </td>
        <td>
            Adds a specified event listener to the selected node<br>
            The binding instruction <strong>must</strong> be a function that is the event listener.<br/>
            <em>(see <a href="#example-13---eventevent-name">Example 13</a>)</em>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <a id="selector-event-bound"></a><code>@event.bound</code>
        </td>
        <td>
            Adds an after bound event to the binding (one only per binder)<br/>
            The binding instruction <strong>must</strong> be a function that is the event listener.<br/>
            <em>(see <a href="#example-14---eventbound">Example 14</a>)</em>
        </td>
    </tr>
</table>


#### Nested Binding Selectors
If the value (binding instruction) of a binding selector is an ```object```, it is treated as descendant binding selectors - this enables you to structure your bindings without having to repeat selectors.

A simple example of using nested binding selectors is to set multiple attributes on the same selected node, e.g.:
```javascript
var myBinder = new Binder('<a><img></a>', {
    '@href': 'url', // set @href attribute on <a>
    'img': { // nested binding selectors for <img>
        '@src': 'imageUrl', // set @src attribute on <img>
        '@width': 'imageWidth', // set @width attribute on <img>
        '@height': 'imageHeight' // set @width attribute on <img>
    }
});
var newNode = myBinder.bind({
    'url': 'https://en.wikipedia.org/wiki/Albert_Einstein',
    'imageUrl': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Einstein_1921_by_F_Schmutzer_-_restoration.jpg/220px-Einstein_1921_by_F_Schmutzer_-_restoration.jpg',
    'imageWidth': 220,
    'imageHeight': 289
});

```
By default, the nested binding selectors are treated as CSS descendant selectors - but you can use explicit child selectors using the usual CSS ```>``` selector, e.g.:
```javascript
var myBinder = new Binder(
    '<div>' + '' +
        '<div class="sub-div-1">' +
            '<div class="sub-div-2">' +
                '<span class="foo"></span>' +
            '</div>' +
            '<span class="foo"></span>' +
        '</div>' +
    '</div>',
    {
        '> .sub-div-1': {
            '> .sub-div-2 .foo': 'name',
            '> .foo': 'description'
        }
    });
```
Note: Immediate child ```>``` selector can **only** be used at top-level binding selectors if the browser supports ```:scope``` pseud-class. <em>(see <a href="#browser-compatibility">Browser Compatibility</a>)</em> 

<br/>

## Binding Instructions

The binding instructions are the property values of the object passed to the binding constructor.  These values can be different types - documented as:

<table>
    <tr>
        <th>Type</th>
        <th>Description</th>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <code>string</code>
        </td>
        <td>
            Choice of:
            <ul>
                <li>
                    A string containing the name a property from the bound data to use as the value.  The propery name can contain <code>.</code> property path seperators to enable traversing the bound data object.  
                </li>
                <li>
                    A string containing occurences of <code>{{}}</code> - parts of the string outside the curly braces are static values and parts inside the curly braces are the names of properties from the bound data  
                </li>
                <li>
                    A string starting with <code>$</code> - is taken as a Javascript expression and evaluated<br/>
                    <em>(these <code>$</code> expressions can also be used within <code>{{}}</code> curly braces - see previous point)  </em>
                </li>
            </ul>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <code>function</code>
        </td>
        <td>
            <em>For data binding selectors:</em><br/><br/>
            A function with one argument that receives the data being bound, e.g.<br/>
            <code>function(data)</code><br/>
            and returns the string to be injected into the template.<br/>
            <br/>
            <br/><em>For event binding selectors:</em><br/><br/>
            A function with four arguments that receive information about the event and data being bound, e.g.<br/>
            <code>function(evt, boundNode, eventNode, data)</code><br/>
            where the arguments are:
            <ul>
                <li><code>evt</code> - the actual event</li>
                <li><code>boundNode</code> - the outer bound node</li>
                <li><code>eventNode</code> - the node to which the event was bound (i.e. as specified by the original binding selector)<br/>
                This node may be different from the <code>evt.target</code> node - for example, if a <code>&lt;button&gt;</code> contained an <code>&lt;img&gt;</code> and the user clicked on the image, this argument would still be the button node.
                </li>
                <li><code>data</code> - the bound data</li>
            </ul>
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td valign="top">
            <code>object</code>
        </td>
        <td>
            The value is an object containing descendant binding selectors<br/>
            (see <a href="#nested-binding-selectors">Nested Binding Selectors</a>)
        </td>
    </tr>
</table>

<br/>

## Binding Instructions Function Scope
The binding instruction functions (including event listener functions) are, by default, bound to the bindings object passed to the constructor - for example, the following code:
```javascript
var myBinder = new Binder('<a></a>', {
    '@id': function(data) {
        console.log("this['@href'] =", this['@href']);
        return 'item-link-' + data.uid; 
    },
    '@href': '/items/{{uid}}',
    '#textContent': 'name'
});
var newNode = myBinder.bind({
    'uid': '27e7a5284dee',
    'name': 'My first item'
});
```
will show output in the console of:
```
this['@href'] = /items/{{uuid}}
```
Which really isn't of great use - which is why the binder constructor provides a third argument which allows you to supply an object for the function scope, e.g.:
```javascript
var myScope = {
    someTestProperty: "foo",
    say: function(what) {
        console.log('Test says... ', what);
    }
};
var myBinder = new Binder('<a></a>', {
    '@id': function(data) {
        console.log("this.someTestProperty =", this.someTestProperty);
        this.say('Hello World!');
        return 'item-link-' + data.uid; 
    },
    '@href': '/items/{{uid}}',
    '#textContent': 'name'
}, myScope);
var newNode = myBinder.bind({
    'uid': '27e7a5284dee',
    'name': 'My first item'
});
```
will show output in the console of:
```
this.someTestProperty = foo
Test says...  Hello World!
```
That's a whole lot more useful!  You can now use the binding function scope to access information outside the bound data.

<br/>

## Cookie-cutter mode & In-place mode
By default, Binder runs in 'cookie-cutter' mode - i.e. everytime you call ```bind(data)``` on your binder it returns a newly created node from your template and binding instructions.  However, Binder also provides an 'in-place' mode - which allows data to be bound and re-bound to an existing static node in the DOM.

To create a binder for 'in-place' mode simply use the fourth argument of the constructor, e.g.:
```javascript
var myBinder = new Binder(document.getElementById('my-inplace-node'),
    {
        '#textContent': 'name'
    },
    null, /* we don't want a binding function scope for now */
    true /* make it an in-place mode binder */);
```
(see also [In-place Demo](./demo/inplace/index.html))

<br/>

## Examples

##### Example 1 - Explict [#textContent](#selector-textcontent)
```javascript
var myBinder = new Binder('<p></p>', {
    '#textContent': 'name'
});
var newNode = myBinder.bind({
    'name': 'Foo Bar'
});
```

##### Example 2 - Implicit [#textContent](#selector-textcontent)
_As example #1 - but without explicitly using the <code>#textContent</code> token_
```javascript
var myBinder = new Binder('<p></p>', {
    '': 'name' // empty binding selector implies #textContent
});
var newNode = myBinder.bind({
    'name': 'Foo Bar'
});
```

##### Example 3 - [#innerHTML](#selector-innerhtml)
```javascript
var myBinder = new Binder('<div><p class="name"></p><ul class="favourites-list"></ul></div>', {
    '.name': 'name',
    '.favourites-list #innerHTML': function(data) {
        var builder = [];
        for (var pty in data.favourites) {
            if (data.favourites.hasOwnProperty(pty)) {
                builder.push('<li>Favourite ' + pty + ' is ' + data.favourites[pty] + '</li>');
            }
        }
        return builder.join('');
    }
});
var newNode = myBinder.bind({
    'name': 'Foo Bar',
    'favourites': {
        'colour': 'Red',
        'fruit': 'Banana',
        'film': 'Star Wars'
    }
});
```

##### Example 4 - [#append](#selector-append)
```javascript
var myBinder = new Binder('<div><p class="name"></p><ul class="favourites-list"></ul></div>', {
    '.name': 'name',
    '.favourites-list #append': function(data) {
        var favNodes = [], favNode;
        for (var pty in data.favourites) {
            if (data.favourites.hasOwnProperty(pty)) {
                favNode = document.createElement('li');
                favNode.textContent = 'Favourite ' + pty + ' is ' + data.favourites[pty]; 
                favNodes.push(favNode);
            }
        }
        return favNodes;
    }
});
var newNode = myBinder.bind({
    'name': 'Foo Bar',
    'favourites': {
        'colour': 'Red',
        'fruit': 'Banana',
        'film': 'Star Wars'
    }
});
```

##### Example 5 - [@_attribute-name_](#selector-attribute-name)
```javascript
var myBinder = new Binder('<a></a>', {
    '#textContent': 'name',
    '@href': 'url'
});
var newNode = myBinder.bind({
    'name': 'Foo Bar',
    'url': '/people/123456'
});
```

##### Example 6 - [@_attribute-name_.remove](#selector-attribute-name-remove)
```javascript
var myBinder = new Binder('<div><input id="" type="text" disabled></div>', {
    'input @id': 'uid',
    'input @disabled.remove': function(data) {
        // return whether to remove disabled attribute or not...
        return data.enabled;
    }
});
var newNode1 = myBinder.bind({
    'uid': 1,
    'enabled': true
});
var newNode2 = myBinder.bind({
    'uid': 2,
    'enabled': false
});
```

##### Example 7 - [@class.add](#selector-class-add)
```javascript
var myBinder = new Binder('<a></a>', {
    '#textContent': 'name',
    '@href': 'url',
    '@class.add': function(data) {
        if (data.active) {
            // return 'active' class token when data is active...
            return 'show-active';
        }
    }
});
var newNode = myBinder.bind({
    'name': 'Foo Bar',
    'url': '/people/123456',
    'active': true
});
```

##### Example 8 - [@class.add](#selector-class-add) (adding multiple classes)
```javascript
var myBinder = new Binder('<a></a>', {
    '#textContent': 'name',
    '@href': 'url',
    '@class.add': function(data) {
        var classTokens = [];
        if (data.active) {
            classTokens.push('show-active');
        }
        if (data.important) {
            classTokens.push('show-important');
        }
        return classTokens;
    }
});
var newNode = myBinder.bind({
    'name': 'Foo Bar',
    'url': '/people/123456',
    'active': true,
    'important': true
});
```

##### Example 9 - [@class.remove](#selector-class-remove)
```javascript
var myBinder = new Binder('<a class="show-active"></a>', {
    '#textContent': 'name',
    '@href': 'url',
    '@class.remove': function(data) {
        if (!data.active) {
            // return 'active' class token to remove when data is not active...
            return 'show-active';
        }
    }
});
var newNode = myBinder.bind({
    'name': 'Foo Bar',
    'url': '/people/123456',
    'active': false
});
```

##### Example 10 - [@class.remove](#selector-class-remove) removing multiple classes
```javascript
var myBinder = new Binder('<a class="show-active show-important"></a>', {
    '#textContent': 'name',
    '@href': 'url',
    '@class.remove': function(data) {
        var classTokens = [];
        if (!data.active) {
            classTokens.push('show-active');
        }
        if (!data.important) {
            classTokens.push('show-important');
        }
        return classTokens;
    }
});
var newNode = myBinder.bind({
    'name': 'Foo Bar',
    'url': '/people/123456',
    'active': false,
    'important': false
});
```

##### Example 11 - [@property._property-name_](#selector-property-name)
```javascript
var myBinder = new Binder('<a></a>', {
    '#textContent': 'name',
    '@href': 'url',
    '@property.dataPropertyAddedToNode': 'additionalData'
});
var newNode = myBinder.bind({
    'name': 'Foo Bar',
    'url': '/people/123456',
    'additionalData': {
        'status': 'ready',
        'fixed': true,
        'modified': false
    }
});
```

##### Example 12 - [@dataset._name_](#selector-dataset-name)
```javascript
var myBinder = new Binder('<a></a>', {
    '#textContent': 'name',
    '@href': 'url',
    // set data-internal-id attribute...
    '@dataset.internalId': 'uid'
});
var newNode = myBinder.bind({
    'name': 'Foo Bar',
    'uid': 123456,
    'url': '/people/123456'
});
```

##### Example 13 - [@event._event-name_](#selector-event-name)
```javascript
var myBinder = new Binder('<button><img width="32" height="32"><span class="label"></span></button>', {
    '.label': 'browser-name',
    'img @src': 'browser-icon',
    '@event.click': function(evt, boundNode, eventNode, data) {
        console.log('You clicked the button' + (eventNode === evt.target ? '' : ' - or something inside it!'));
    }
});
var newNode = myBinder.bind({
    'browser-name': 'Chrome',
    'browser-icon': 'https://cdnjs.cloudflare.com/ajax/libs/browser-logos/35.1.0/chrome/chrome_512x512.png'
});
```

##### Example 14 - [@event.bound](#selector-event-bound)
```javascript
var myBinder = new Binder('<a></a>', {
    '#textContent': 'name',
    '@href': 'url',
    '@event.bound': function(evt, boundNode, eventNode, data) {
        console.log('You just bound data: ', data, ' to node: ', boundNode);
    }
});
var newNode = myBinder.bind({
    'name': 'Foo Bar',
    'url': '/people/123456'
});
```

<br/>

## How It Works

Binder is designed to be fast and easy to use.  Its speed is derived from the way it utilises node cloning (which out performs element creation on almost all browsers - see [jsPerf - cloneNode vs createElement Performance](https://jsperf.com/clonenode-vs-createelement-performance/2)).
 
When a new binder is instantiated, it compiles the bindings into stored pointers to the nodes to be populated and functions for obtaining the values used to populate - so that when the <code>bind()</code> occurs everything is known (no re-interpreting of the bindings).  Even the templated string <a href="#binding-instructions">binding instructions</a> (strings containing ```{{}}```) are compiled into functions that are re-used at bind time.     

<br/>

## Browser Compatibility
<table>
    <tr>
        <td align="center" valign="top">
            <img src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/35.1.0/chrome/chrome_512x512.png" alt="Chrome" width="32px" height="32px"/><br/>
            Chrome
        </td>
        <td align="center" valign="top">
            <img src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/35.1.0/firefox/firefox_512x512.png" alt="Firefox" width="32px" height="32px"/><br/>
            Firefox
        </td>
        <td align="center" valign="top">
            <img src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/35.1.0/safari-ios/safari-ios_512x512.png" alt="Safari iOS" width="32px" height="32px"/><br/>
            Safari
        </td>
        <td align="center" valign="top">
            <img src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/35.1.0/internet-explorer/internet-explorer_512x512.png" alt="IE" width="32px" height="32px"/><br/>
            Internet<br/>
            Explorer
        </td>
        <td align="center" valign="top">
            <img src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/35.1.0/edge/edge_512x512.png" alt="Edge" width="32px" height="32px"/><br/>
            Edge
        </td>
        <td align="center" valign="top">
            <img src="https://cdnjs.cloudflare.com/ajax/libs/browser-logos/35.1.0/opera/opera_512x512.png" alt="Opera" width="32px" height="32px"/><br/>
            Opera
        </td>
    </tr>
    <tr>
        <td align="center" valign="top">
            <strong>49+</strong>
        </td>
        <td align="center" valign="top">
            <strong>52+</strong>
        </td>
        <td align="center" valign="top">
            <strong>10.1+</strong>
        </td>
        <td align="center" valign="top">
            <strong>11</strong> <sup>[1]</sup><br/><br/>
        </td>
        <td align="center" valign="top">
            <strong>14</strong>
        </td>
        <td align="center" valign="top">
            <strong>45+</strong>
        </td>
    </tr>
</table>
<sub>[1] Does not support <code>:scope</code> - so <code>&gt;</code> cannot be used on top-level <a href="#binding-selectors">binding selectors</a></sub>    
