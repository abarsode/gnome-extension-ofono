 /*
  * Copyright (C) 2011 Intel Corporation. All rights reserved.
  * Author: Alok Barsode <alok.barsode@intel.com>
  *
  * This program is free software: you can redistribute it and/or modify
  * it under the terms of the GNU General Public License as published by
  * the Free Software Foundation, either version 2 of the License, or
  * (at your option) any later version.
  *
  * This program is distributed in the hope that it will be useful,
  * but WITHOUT ANY WARRANTY; without even the implied warranty of
  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  * GNU General Public License for more details.
  *
  * You should have received a copy of the GNU General Public License
  * along with this program.  If not, see <http://www.gnu.org/licenses/>.
  */

const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const Gettext = imports.gettext;
const Clutter = imports.gi.Clutter;
const ModalDialog = imports.ui.modalDialog;
const ShellEntry = imports.ui.shellEntry;
const MessageTray = imports.ui.messageTray;
const CheckBox = imports.ui.checkBox;
const Util = imports.misc.util;
const _ = Gettext.gettext;

const BUS_NAME = 'org.ofono';
const DIALOG_TIMEOUT = 120*1000;

let _extension = null;

const State = {
    DISABLED:0,
    NOSIM:1,
    PINREQUIRED:2,
    PUKREQUIRED:3,
    SIMREADY:4,
    AVAILABLE:5,
    GSM:6,
    EDGE:7,
    UMTS:8,
    HSPA:9,
    LTE:10
};

function status_to_string(status) {
    switch(status) {
    case State.DISABLED:
	return _("Disabled");
    case State.NOSIM:
	return _("No SIM");
    case State.PINREQUIRED:
	return _("PIN Required");
    case State.PUKREQUIRED:
	return _("PUK Required");
    case State.SIMREADY:
	return _("SIM Ready");
    case State.AVAILABLE:
	return _("Available");
    case State.GSM:
	return _("GPRS Available");
    case State.EDGE:
	return _("EDGE Available");
    case State.UMTS:
	return _("3G Available");
    case State.HSPA:
	return _("High Speed Available");
    case State.LTE:
	return _("LTE Available");
    default:
	return _("Error");
    }
}

function status_to_icon(status) {
    switch(status) {
    case State.DISABLED:
    case State.NOSIM:
    case State.SIMREADY:
	return 'network-cellular-umts-symbolic';
    case State.PINREQUIRED:
    case State.PUKREQUIRED:
	return 'dialog-password-symbolic';
    case State.AVAILABLE:
	return 'network-cellular-umts-symbolic';
    case State.GSM:
	return 'network-cellular-gprs-symbolic';
    case State.EDGE:
	return  'network-cellular-edge-symbolic';
    case State.UMTS:
    case State.HSPA:
	return  'network-cellular-3g-symbolic';
    case State.LTE:
	return  'network-cellular-4g-symbolic';
    default:
	return 'network-cellular-umts-symbolic';
    }
}

// const APNDialog = new Lang.Class({
//     Name: 'PinDialog',
//     Extends: ModalDialog.ModalDialog,
//     _init: function(path) {
// 	this.parent({ styleClass: 'prompt-dialog' });
// 	this.context = new ConnectionContextProxy(Gio.DBus.system, BUS_NAME, path);

// 	/* Create the main container of the dialog */
// 	let mainContentBox = new St.BoxLayout({ style_class: 'prompt-dialog-main-layout', vertical: false });
//         this.contentLayout.add(mainContentBox,
//                                { x_fill: true,
//                                  y_fill: true });

// 	/* Add the dialog password icon */
//         let icon = new St.Icon({ icon_name: 'dialog-password-symbolic' });
//         mainContentBox.add(icon,
//                            { x_fill:  true,
//                              y_fill:  false,
//                              x_align: St.Align.END,
//                              y_align: St.Align.START });

// 	/* Add a Message to the container */
//         this.messageBox = new St.BoxLayout({ style_class: 'prompt-dialog-message-layout',
//                                             vertical: true });
//         mainContentBox.add(this.messageBox,
//                            { y_align: St.Align.START });

// 	/* Add a Header Label in the Message */
//         let subjectLabel = new St.Label({ style_class: 'prompt-dialog-headline',
// 					  text: "Access Point Name required"});

//         this.messageBox.add(subjectLabel,
//                        { y_fill:  false,
//                          y_align: St.Align.START });

// 	/* Create a box container */
//         this.apnBox = new St.BoxLayout({ vertical: false });
// 	this.messageBox.add(this.apnBox, { y_fill: true, y_align: St.Align.START, expand: true });

// 	/* PIN Label */
//         this.apnLabel = new St.Label(({ style_class: 'prompt-dialog-description', text: "APN "}));
//         this.apnBox.add(this.apnLabel,  { y_fill: false, y_align: St.Align.START });

// 	/* PIN Entry */
//         this._apnEntry = new St.Entry({ style_class: 'prompt-dialog-password-entry', text: "", can_focus: true });
//         ShellEntry.addContextMenu(this._apnEntry, { isPassword: false });

//         this.apnBox.add(this._apnEntry, {expand: true, y_align: St.Align.END });

// 	this._apnEntry.clutter_text.connect('text-changed', Lang.bind(this, this.UpdateOK));

//         this.okButton = { label:  _("Set APN"),
//                            action: Lang.bind(this, this.onOk),
//                            key:    Clutter.KEY_Return,
//                          };

//         this.setButtons([{ label: _("Cancel"),
//                            action: Lang.bind(this, this.onCancel),
//                            key:    Clutter.KEY_Escape,
//                          },
//                          this.okButton]);

// 	this.timeoutid = Mainloop.timeout_add(DIALOG_TIMEOUT, Lang.bind(this, function() {
// 	    this.onCancel();
// 	    return false;
// 	}));

// 	this.open();

// 	this.UpdateOK();

// 	global.stage.set_key_focus(this._apnEntry);
//     },

//     onOk: function() {
// 	this.close();

// 	Mainloop.source_remove(this.timeoutid);

// 	let apn = GLib.Variant.new('s', this._apnEntry.get_text());
// 	this.context.SetPropertyRemote('AccessPointName', apn, Lang.bind(this, function(result, excp) {
// 		this.destroy();
// 	}));
//     },

//     onCancel: function() {
// 	this.close();

// 	Mainloop.source_remove(this.timeoutid);

// 	this.destroy();
//     },

//     UpdateOK: function() {
// 	let enable = false;
// 	let pass = this._apnEntry.get_text();

// 	    if (pass.length >= 1)
// 		enable = true;
// 	    else
// 		enable = false;

// 	if (enable) {
// 	    this.okButton.button.reactive = true;
// 	    this.okButton.button.can_focus = true;
// 	    this.okButton.button.remove_style_pseudo_class('disabled');
// 	    this._apnEntry.clutter_text.connect('activate', Lang.bind(this, this.onOk));
// 	} else {
// 	    this.okButton.button.reactive = false;
// 	    this.okButton.button.can_focus = false;
// 	    this.okButton.button.add_style_pseudo_class('disabled');
// 	}
//     }
// });


/* UI PIN DIALOG SECTION */
const PinDialog = new Lang.Class({
    Name: 'PinDialog',
    Extends: ModalDialog.ModalDialog,
    _init: function(modem, pin_type, retries) {
	this.parent({ styleClass: 'prompt-dialog' });
	this.modem = modem;
	this.pin_type = pin_type;

	/* Create the main container of the dialog */
	let mainContentBox = new St.BoxLayout({ style_class: 'prompt-dialog-main-layout', vertical: false });
        this.contentLayout.add(mainContentBox,
                               { x_fill: true,
                                 y_fill: true });

	/* Add the dialog password icon */
        let icon = new St.Icon({ icon_name: 'dialog-password-symbolic' });
        mainContentBox.add(icon,
                           { x_fill:  true,
                             y_fill:  false,
                             x_align: St.Align.END,
                             y_align: St.Align.START });

	/* Add a Message to the container */
        this.messageBox = new St.BoxLayout({ style_class: 'prompt-dialog-message-layout',
                                            vertical: true });
        mainContentBox.add(this.messageBox,
                           { y_align: St.Align.START });

	/* Add a Header Label in the Message */
        let subjectLabel = new St.Label({ style_class: 'prompt-dialog-headline',
					  text: "Authentication required to access SIM"});

        this.messageBox.add(subjectLabel,
                       { y_fill:  false,
                         y_align: St.Align.START });

	/* Add a Description Label in the Message */
        this.descriptionLabel = new St.Label({ style_class: 'prompt-dialog-description', text: "" });
        this.messageBox.add(this.descriptionLabel, { y_fill: true, y_align: St.Align.MIDDLE, expand: true });

	/* Set the description lable according to the pin type */
	if (pin_type == "pin")
	    this.descriptionLabel.text = "PIN required to unlock SIM." ;
	else if (pin_type == "puk")
	    this.descriptionLabel.text = "PUK required to unlock PIN";
	else
	    this.descriptionLabel.text = pin_type + "required to access SIM";

	/* Create a box container */
        this.pinBox = new St.BoxLayout({ vertical: false });
	this.messageBox.add(this.pinBox, { y_fill: true, y_align: St.Align.MIDDLE, expand: true });

	/* PIN Label */
        this.pinLabel = new St.Label(({ style_class: 'prompt-dialog-description', text: ""}));
        this.pinBox.add(this.pinLabel,  { y_fill: false, y_align: St.Align.START });

	/* Set the description lable according to the pin type */
	if (pin_type == "pin")
	    this.pinLabel.text = "PIN ";
	else if (pin_type == "puk")
	    this.pinLabel.text = "PUK        ";
	else if (pin_type == "pin2")
	    this.pinLabel.text = "PIN2 ";
	else if (pin_type == "puk2")
	    this.pinLabel.text = "PUK2        ";
	else
	    this.pinLabel.text = pin_type;

	/* PIN Entry */
        this._pinEntry = new St.Entry({ style_class: 'prompt-dialog-password-entry', text: "", can_focus: true });
        ShellEntry.addContextMenu(this._pinEntry, { isPassword: true });

        this.pinBox.add(this._pinEntry, {expand: true, y_align: St.Align.END });
	this._pinEntry.clutter_text.set_password_char('\u25cf');

	this._pinEntry.clutter_text.connect('text-changed', Lang.bind(this, this.UpdateOK));

	/* New PIN Label */
	if (pin_type == 'puk' || pin_type == 'puk2') {
            this.newpinBox = new St.BoxLayout({ vertical: false });
	    this.messageBox.add(this.newpinBox, { y_fill: true, y_align: St.Align.MIDDLE, expand: true });

            this.newpinLabel = new St.Label(({ style_class: 'prompt-dialog-description', text: ""}));
            this.newpinBox.add(this.newpinLabel,  { y_fill: false, y_align: St.Align.START });

	    /* Set the description lable according to the pin type */
	    if (pin_type == "puk")
		this.newpinLabel.text = "New PIN ";
	    else if (pin_type == "puk2")
		this.newpinLabel.text = "New PIN2 ";

	    /* PIN Entry */
            this._newpinEntry = new St.Entry({ style_class: 'prompt-dialog-password-entry', text: "", can_focus: true });
            ShellEntry.addContextMenu(this._newpinEntry, { isPassword: true });

            this.newpinBox.add(this._newpinEntry, {expand: true, y_align: St.Align.END });
	    this._newpinEntry.clutter_text.set_password_char('\u25cf');

	    this._newpinEntry.clutter_text.connect('activate', Lang.bind(this, this.onOk));
	    this._newpinEntry.clutter_text.connect('text-changed', Lang.bind(this, this.UpdateOK));
	}

	/* Add a Retry Label in the Message */
        this.retryLabel = new St.Label({ style_class: 'prompt-dialog-description', text: "" });
        this.messageBox.add(this.retryLabel, { y_fill: true, y_align: St.Align.MIDDLE, expand: true });

	/* Set the description lable according to the pin type */

	if (pin_type == 'pin' || pin_type == 'puk' || pin_type == 'pin2' || pin_type == 'puk2')
	    this.retryLabel.text = retries[pin_type] + " attempts left to Unlock.";

        this.okButton = { label:  _("Unlock"),
                           action: Lang.bind(this, this.onOk),
                           key:    Clutter.KEY_Return,
                         };

        this.setButtons([{ label: _("Cancel"),
                           action: Lang.bind(this, this.onCancel),
                           key:    Clutter.KEY_Escape,
                         },
                         this.okButton]);

	this.timeoutid = Mainloop.timeout_add(DIALOG_TIMEOUT, Lang.bind(this, function() {
	    this.onCancel();
	    return false;
	}));

	this.open();

	this.UpdateOK();

	global.stage.set_key_focus(this._pinEntry);
    },

    onOk: function() {
	this.close();

	Mainloop.source_remove(this.timeoutid);

	if (this.pin_type == 'pin' || this.pin_type == 'pin2') {
	    this.modem.EnterPinRemote(this.pin_type, this._pinEntry.get_text(),  Lang.bind(this, function(result, excp) { 
		this.destroy();
	    }));
	}

	if (this.pin_type == 'puk' || this.pin_type == 'puk2') {
	    this.modem.ResetPinRemote(this.pin_type, this._pinEntry.get_text(), this._newpinEntry.get_text(), Lang.bind(this, function(result, excp) {
		this.destroy();
	    }));
	}
    },

    onCancel: function() {
	this.close();

	Mainloop.source_remove(this.timeoutid);

	this.destroy();
    },

    UpdateOK: function() {
	let enable = false;

	if (this.pin_type == 'pin' || this.pin_type == 'pin2') {
	    let pass = this._pinEntry.get_text();

	    if (pass.length >= 4)
		enable = true;
	    else
		enable = false;
	}

	if (this.pin_type == 'puk' || this.pin_type == 'puk2') {
	    let pass = this._pinEntry.get_text();
	    let newpin = this._newpinEntry.get_text();

	    if (pass.length >= 8 && newpin.length >=4)
		enable = true;
	    else
		enable = false;
	}

	if (enable) {
	    this.okButton.button.reactive = true;
	    this.okButton.button.can_focus = true;
	    this.okButton.button.remove_style_pseudo_class('disabled');
	    this._pinEntry.clutter_text.connect('activate', Lang.bind(this, this.onOk));
	} else {
	    this.okButton.button.reactive = false;
	    this.okButton.button.can_focus = false;
	    this.okButton.button.add_style_pseudo_class('disabled');
	}
    }
});

/* org.ofono.ConnectionContext Interface */
const ConnectionContextInterface = <interface name="org.ofono.ConnectionContext">
<method name="GetProperties">
    <arg name="properties" type="a{sv}" direction="out"/>
</method>
<method name="SetProperty">
    <arg name="name" type="s" direction="in"/>
    <arg name="value" type="v" direction="in"/>
</method>
<signal name="PropertyChanged">
    <arg name="name" type="s"/>
    <arg name="value" type="v"/>
</signal>
</interface>;

const ConnectionContextProxy = Gio.DBusProxy.makeProxyWrapper(ConnectionContextInterface);

/* org.ofono.ConnectionManager Interface */
const ConnectionManagerInterface = <interface name="org.ofono.ConnectionManager">
<method name="GetProperties">
    <arg name="properties" type="a{sv}" direction="out"/>
</method>
<method name="SetProperty">
    <arg name="name" type="s" direction="in"/>
    <arg name="value" type="v" direction="in"/>
</method>
<method name="GetContexts">
    <arg name="contexts" type="a(oa{sv})" direction="out"/>
</method>
<method name="AddContext">
    <arg name="type" type="s" direction="in"/>
    <arg name="path" type="o" direction="out"/>
</method>
<signal name="PropertyChanged">
    <arg name="name" type="s"/>
    <arg name="value" type="v"/>
</signal>
<signal name="ContextAdded">
    <arg name="path" type="o"/>
    <arg name="properties" type="a{sv}"/>
</signal>
<signal name="ContextRemoved">
    <arg name="path" type="o"/>
</signal>
</interface>;

const ConnectionManagerProxy = Gio.DBusProxy.makeProxyWrapper(ConnectionManagerInterface);

/* org.ofono.SimManager Interface */
const SimManagerInterface = <interface name="org.ofono.SimManager">
<method name="GetProperties">
    <arg name="properties" type="a{sv}" direction="out"/>
</method>
<method name="SetProperty">
    <arg name="name" type="s" direction="in"/>
    <arg name="value" type="v" direction="in"/>
</method>
<method name="EnterPin">
    <arg name="type" type="s" direction="in"/>
    <arg name="pin" type="s" direction="in"/>
</method>
<method name="ResetPin">
    <arg name="type" type="s" direction="in"/>
    <arg name="puk" type="s" direction="in"/>
    <arg name="newpin" type="s" direction="in"/>
</method>
<signal name="PropertyChanged">
    <arg name="name" type="s"/>
    <arg name="value" type="v"/>
</signal>
</interface>;

const SimManagerProxy = Gio.DBusProxy.makeProxyWrapper(SimManagerInterface);

/* org.ofono.Modem Interface */
const ModemInterface = <interface name="org.ofono.Modem">
<method name="SetProperty">
    <arg name="name" type="s" direction="in"/>
    <arg name="value" type="v" direction="in"/>
</method>
<signal name="PropertyChanged">
    <arg name="name" type="s"/>
    <arg name="value" type="v"/>
</signal>
</interface>;

const ModemProxy = Gio.DBusProxy.makeProxyWrapper(ModemInterface);

const ContextItem = new Lang.Class({
    Name: 'ContextItem',

    _init: function(path, properties, modem) {
	this.path	= path;
	this.modem	= modem;
	this.proxy	= new ConnectionContextProxy(Gio.DBus.system, BUS_NAME, path);
	this.name	= null;
	this.config	= false;
	this.active	= false;
	this._source	= null;

	this.context_section = null;

	this.prop_sig = this.proxy.connectSignal('PropertyChanged', Lang.bind(this, function(proxy, sender,[property, value]) {
	    if (property == 'Active')
		this.set_active(value.deep_unpack());
	    if (property == 'Name')
		this.set_name(value.deep_unpack());
	}));

	this.active = properties.Active.deep_unpack();

	this.apn = properties.AccessPointName.deep_unpack();
	if (this.apn == "") {
	    this.name = _("Click to Configure Internet...");
	    this.config = false;
	    Util.spawn(['ofono-wizard', '-p', this.modem.path]);
	} else {
	    this.name = properties.Name.deep_unpack();
	    this.config = true;
	}
    },

    CreateContextItem: function() {
	this.context_section = new PopupMenu.PopupBaseMenuItem();
	this.label = new St.Label();
	this.label.text = this.name;
	this.context_section.addActor(this.label);

	this.context_section.connect('activate', Lang.bind(this, this.clicked));

	return this.context_section;
    },

    clicked: function() {
	if (this.config == false) {
	    Util.spawn(['ofono-wizard', '-p', this.modem.path]);
	    return;
	}

	if (!this.active && !this.modem.online) {
	    this.modem_not_online();
	    return;
	}

	let val = GLib.Variant.new('b', !this.active);
	this.proxy.SetPropertyRemote('Active', val, Lang.bind(this, function(result, excp) {
	    if (excp)
		this.reconfigure();
	}));
    },

    reconfigure: function() {
        this._ensureSource();

	let title = _("%s - Unable to connect to the network").format(this.modem.name);

        let icon = new St.Icon({ icon_name: 'network-cellular-signal-none-symbolic',
                                 icon_size: MessageTray.NOTIFICATION_ICON_SIZE });

        this.notification = new MessageTray.Notification(this._source, title, null,
                                                            { icon: icon, customContent:true });

	this.notification.addBody(_("%s is unable to connect to the network. Make sure you configured the connection correctly or press 'Configure' to configure again.").format(this.modem.name));
	this.notification.addButton('Configure', _("Configure"));

	this.notification.connect('action-invoked', Lang.bind(this, function(self, action) {
	    if (action == 'Configure') {
		Util.spawn(['ofono-wizard', '-p', this.modem.path]);
		this.notification.destroy();
	    }
	}));

        this.notification.setUrgency(MessageTray.Urgency.HIGH);
        this.notification.setResident(true);

        this._source.notify(this.notification);
    },

    set_active: function(active) {
	this.active = active;
	this.context_section.setShowDot(active);
    },

    set_name: function(name) {
	this.name = name;
	this.label.text = this.name;
	this.config = true;
    },

    _ensureSource: function() {
        if (!this._source) {
            this._source = new MessageTray.Source(_("oFono"),
                                                  'network-error-symbolic');

            this._source.connect('destroy', Lang.bind(this, function() {
                this._source = null;
            }));
            Main.messageTray.add(this._source);
        }
    },

    modem_not_online: function() {
        this._ensureSource();

	let title = _("%s is not online").format(this.modem.name);
	let text = _("%s is not connected to the network. Enable Cellular in Connection Manager to activate this connection.").format(this.modem.name);

        let icon = new St.Icon({ icon_name: 'network-cellular-signal-none-symbolic',
                                 icon_size: MessageTray.NOTIFICATION_ICON_SIZE });

        let _notification = new MessageTray.Notification(this._source, title, text,
                                                            { icon: icon });
        _notification.setUrgency(MessageTray.Urgency.HIGH);
        _notification.setTransient(true);
        this._source.notify(_notification);
    },

    CleanUp: function() {
	if (this.prop_sig)
	    this.proxy.disconnectSignal(this.prop_sig);

	if (this.notification)
	    this.notification.destroy();

	if (this._source)
            this._source = null;

	this.context_section.destroy();
    }
});

const ModemItem = new Lang.Class({
    Name: 'Modems.ModemItem',

    _init: function(path, properties) {
	this.path	= path;
	this.proxy	= new ModemProxy(Gio.DBus.system, BUS_NAME, path);
	this.Item	= new PopupMenu.PopupMenuSection();
	this.contexts	= {};

	this.powered		= properties.Powered.deep_unpack();
	this.online		= properties.Online.deep_unpack();
	this.type		= properties.Type.deep_unpack();
	this.interfaces		= null;
	this.sim_present	= false;
	this.sim_pin		= null;
	this.sim_pin_retry	= null;
	this.status		= State.DISABLED;
	this.bearer		= "none";
	this.attached		= false;
	this.connection_manager = null;
	this.sim_manager	= null;
	this.roaming_allowed	= null;

	if (properties.Name)
	    this.name	= properties.Name.deep_unpack();
	else if (properties.Manufacturer) {
	    this.manufacturer = properties.Manufacturer.deep_unpack();

	    if (properties.Model) {
		this.model = properties.Model.deep_unpack();
		this.name = this.manufacturer + '-' + this.model
	    } else
		this.name = this.manufacturer;
	} else
	    this.name = "Modem";

	this.set_interfaces(properties.Interfaces.deep_unpack());

	this.prop_sig = this.proxy.connectSignal('PropertyChanged', Lang.bind(this, function(proxy, sender,[property, value]) {
		if (property == 'Powered')
		    this.set_powered(value.deep_unpack());
		if (property == 'Online')
		    this.set_online(value.deep_unpack());
		if (property == 'Manufacturer')
		    this.set_manufacturer(value.deep_unpack());
		if (property == 'Model')
		    this.set_model(value.deep_unpack());
		if (property == 'Name')
		    this.set_name(value.deep_unpack());
		if (property == 'Interfaces')
		    this.set_interfaces(value.deep_unpack());
	}));
    },

    CreateMenuItem: function() {
	/* Create a Menu Item for this modem. */
	this.sw = new PopupMenu.PopupSwitchMenuItem(null, this.powered);
	this.sw.label.text = this.name;

	this.sw.connect('toggled',  Lang.bind(this, function(item, state) {
	    let val = GLib.Variant.new('b', state);
	    this.proxy.SetPropertyRemote('Powered', val);
	}));

	this.Item.addMenuItem(this.sw);

	this.status_section = new PopupMenu.PopupBaseMenuItem();

	this.label = new St.Label();
	this.label.text = _("Status:");
	this.status_section.addActor(this.label);

	this.status_label = new St.Label();
	this.status_label.text = status_to_string(this.status);
	this.status_section.addActor(this.status_label, { align: St.Align.END });

	this.Item.addMenuItem(this.status_section);

	this.update_status();

	this.status_section.connect('activate', Lang.bind(this, this.clicked));

	if (Object.keys(this.contexts).length > 0) {
	    for each (let path in Object.keys(this.contexts)) {
		this.Item.addMenuItem(this.contexts[path].context.CreateContextItem());
	    }
	}
	return this.Item;
    },

    set_powered: function(powered) {
	this.powered = powered;
	this.sw.setToggleState(powered);
	this.update_status();
    },

    set_online: function(online) {
	this.online = online;
	this.update_status();
    },

    set_manufacturer: function(manufacturer) {
	this.manufacturer = manufacturer;
	if (this.model)
	    this.name = this.manufacturer + '-' + this.model;
	else
	    this.name = this.manufacturer;

	this.sw.label.text = this.name;
    },

    set_model: function(model) {
	this.model = model;
	if (this.manufacturer)
	    this.name = this.manufacturer + '-' + this.model;
	else
	    this.name = "Modem" + '-' + this.model;
	this.sw.label.text = this.name;
    },

    set_name: function(name) {
	this.name = name;
	this.sw.label.text = this.name;
    },

    set_interfaces: function(interfaces) {
	this.interfaces = interfaces;

	if (this.sim_manager == null && this.interfaces.indexOf('org.ofono.SimManager') != -1) {

	    this.sim_manager = new SimManagerProxy(Gio.DBus.system, BUS_NAME, this.path);

	    this.sim_manager.GetPropertiesRemote(Lang.bind(this, function(result, excp) {
		/* result contains the exported Properties.
		 * properties is a dict a{sv}. They can be accessed by
		 * properties.<Property Name>.deep_unpack() which unpacks the variant.
		 */
		let properties = result[0];

		if (properties.Present)
		    this.sim_present	= properties.Present.deep_unpack();
		else
		    this.sim_present	= null;

		if (properties.PinRequired)
		    this.sim_pin	= properties.PinRequired.deep_unpack();
		else
		    this.sim_pin	= null;

		if (properties.Retries)
		    this.sim_pin_retry	= properties.Retries.deep_unpack();
		else
		    this.sim_pin_retry	= null;

		this.dialog		= null;

		this.update_status();
		this.enter_pin();
	    }));

	    this.sim_prop_sig = this.sim_manager.connectSignal('PropertyChanged', Lang.bind(this, function(proxy, sender,[property, value]) {
		if (property == 'Present')
		    this.set_sim_present(value.deep_unpack());
		if (property == 'PinRequired')
		    this.set_sim_pinrequired(value.deep_unpack());
		if (property == 'Retries')
		    this.set_sim_pin_retries(value.deep_unpack());
	    }));
	}

	if (this.connection_manager == null && this.interfaces.indexOf('org.ofono.ConnectionManager') != -1) {

	    this.connection_manager = new ConnectionManagerProxy(Gio.DBus.system, BUS_NAME, this.path);

	    this.connection_manager.GetPropertiesRemote(Lang.bind(this, function(result, excp) {
		/* result contains the exported Properties.
		 * properties is a dict a{sv}. They can be accessed by
		 * properties.<Property Name>.deep_unpack() which unpacks the variant.
		 */
		let properties = result[0];

		if (properties.Attached)
		    this.set_attached(properties.Attached.deep_unpack());

		if (properties.Bearer)
		    this.set_bearer(properties.Bearer.deep_unpack());

		if (properties.RoamingAllowed)
		    this.set_roaming(properties.RoamingAllowed.deep_unpack());

	    }));

	    this.connman_prop_sig = this.connection_manager.connectSignal('PropertyChanged', Lang.bind(this, function(proxy, sender,[property, value]) {
		if (property == 'Attached')
		    this.set_attached(value.deep_unpack());
		if (property == 'Bearer')
		    this.set_bearer(value.deep_unpack());
		if (property == 'RoamingAllowed')
		    this.set_roaming(value.deep_unpack());
	    }));

	    this.connman_sig_contextadd = this.connection_manager.connectSignal('ContextAdded', Lang.bind(this, function(proxy, sender,[path, properties]) {
		if (Object.getOwnPropertyDescriptor(this.contexts, path)) {
		    return;
		}

		this.contexts[path] = { context: new ContextItem(path, properties, this)};
		this.Item.addMenuItem(this.contexts[path].context.CreateContextItem());
	    }));

	    this.connman_sig_contextrem = this.connection_manager.connectSignal('ContextRemoved', Lang.bind(this, function(proxy, sender, path) {
		if (!Object.getOwnPropertyDescriptor(this.contexts, path)) {
		    return;
		}

		this.contexts[path].context.CleanUp();
		delete this.contexts[path];

		if (Object.keys(this.contexts).length == 0) {
		    this.add_context();
		}
	    }));

	    this.connection_manager.GetContextsRemote (Lang.bind(this, function(result, excp) {
		/* result contains the exported Contexts.
		 * contexts is a array of path and dict a{sv}.
		 */
		if (result == null)
		    return;

		let contexts = result[0];

		/* If there are no contexts at all , we need to create an internet context */
		if (contexts.length == 0) {
		    this.add_context();
		    return;
		}

		for each (let [path, properties] in contexts) {
		    if ((properties.Type.deep_unpack() != "internet"))
			continue;

		    if (Object.getOwnPropertyDescriptor(this.contexts, path)) {
			this.contexts[path].context.UpdateProperties(properties);
		    } else {
			this.contexts[path] = { context: new ContextItem(path, properties, this)};
			this.Item.addMenuItem(this.contexts[path].context.CreateContextItem());
		    }
		};

		/* If there are no internet contexts found, we need to create one */
		if (Object.keys(this.contexts).length == 0) {
		    this.add_context();
		}
	    }));
	}
    },

    add_context: function() {
	this.add_context_section = new PopupMenu.PopupBaseMenuItem();
	let label = new St.Label();
	label.text = _("Click to add Internet connection..");
	this.add_context_section.addActor(label);

	this.Item.addMenuItem(this.add_context_section);

	this.add_context_section.connect('activate', Lang.bind(this, function(){

	    let val = GLib.Variant.new('s', "internet");
	    this.connection_manager.AddContextRemote("internet", Lang.bind(this, function(result, excp) {
	    }));

	    this.add_context_section.destroy();
	}));
    },

    set_sim_present: function(present) {
	this.sim_present = present;
	this.update_status();
    },

    set_sim_pinrequired: function(pinrequired) {
	this.sim_pin = pinrequired;
	this.update_status();
	this.enter_pin();
    },

    set_sim_pin_retries: function(retries) {
	this.sim_pin_retry = retries;
	this.enter_pin();
    },

    enter_pin: function() {
	if (this.sim_pin == null || this.sim_pin_retry == null)
	    return;

	if (this.sim_pin == 'none')
	    return;

	if (this.sim_pin_retry[this.sim_pin] > 0) {
	    if (this.dialog)
		this.dialog.destroy();

	    if (this.dialog == null)
		this.dialog = new PinDialog(this.sim_manager, this.sim_pin, this.sim_pin_retry);
	}
    },

    update_status: function() {
	if (this.powered == false) {
	    this.status = State.DISABLED;
	}else {
	    if (this.sim_present == false) {
		this.status = State.NOSIM;
	    } else {
		if (this.sim_pin && this.sim_pin != "none") {
		    /* Handle all values? */
		    if (this.sim_pin == "pin" || this.sim_pin == "pin2")
			this.status = State.PINREQUIRED;
		    else if (this.sim_pin == "puk" || this.sim_pin == "puk2")
			this.status = State.PUKREQUIRED;
		    else
			this.status = State.PINREQUIRED;
		} else {
		    if (this.attached == true) {
			if (this.bearer == 'gsm')
			    this.status = State.GSM;
			else if (this.bearer == 'edge')
			    this.status = State.EDGE;
			else if (this.bearer == 'umts')
			    this.status = State.UMTS;
			else if (this.bearer == 'hsdpa' || this.bearer == 'hsupa' || this.bearer == 'hspa')
			    this.status = State.HSPA;
			else if (this.bearer == 'lte')
			    this.status = State.LTE;
			else
			    this.status = State.AVAILABLE;
		    } else
			this.status = State.SIMREADY;
		}
	    }
	}

	if (this.status_label)
	    this.status_label.text = status_to_string(this.status);

	_extension.update_icon();
    },

    set_attached: function(attached) {
	this.attached = attached;
	this.update_status();
    },

    set_bearer: function(bearer) {
	this.bearer = bearer;
	this.update_status();
    },

    set_roaming: function(roaming) {
	if (this.roaming_allowed == null) {
	    this.roaming_allowed = new PopupMenu.PopupSwitchMenuItem(null, roaming);
	    this.roaming_allowed.label.text = "Allow Roaming";

	    this.roaming_allowed.connect('toggled',  Lang.bind(this, function(item, state) {
		let val = GLib.Variant.new('b', state);
		this.connection_manager.SetPropertyRemote('RoamingAllowed', val);
	    }));

	    this.Item.addMenuItem(this.roaming_allowed);
	} else
	    this.roaming_allowed.setToggleState(roaming);
    },

    clicked: function() {
	if (this.sim_pin && this.sim_pin == "none")
	    return;

	if (this.sim_manager && this.sim_pin && (this.sim_pin_retry[this.sim_pin] >= 0))
	    this.dialog = new PinDialog(this.sim_manager, this.sim_pin, this.sim_pin_retry);
    },

    UpdateProperties: function(properties) {

    },

    CleanUp: function() {
	if (this.prop_sig)
	    this.proxy.disconnectSignal(this.prop_sig);

	if (this.sim_prop_sig)
	    this.sim_manager.disconnectSignal(this.sim_prop_sig);

	if (this.connman_prop_sig)
	    this.connection_manager.disconnectSignal(this.connman_prop_sig);

	if (this.connman_sig_contextadd)
	    this.connection_manager.disconnectSignal(this.connman_sig_contextadd);

	if (this.connman_sig_contextrem)
	    this.connection_manager.disconnectSignal(this.connman_sig_contextrem);

	if (this.contexts) {
	    for each (let path in Object.keys(this.contexts)) {
		this.contexts[path].context.CleanUp();
		delete this.contexts[path];
            }

	    delete this.contexts;
	}

	if (this.Item)
	    this.Item.destroy();

	if (this.dialog)
	    this.dialog.destroy();

    }
});

/* org.ofono.Manager Interface */
const ManagerInterface = <interface name="org.ofono.Manager">
<method name="GetModems">
    <arg name="modems" type="a(oa{sv})" direction="out"/>
</method>
<signal name="ModemAdded">
    <arg name="path" type="o"/>
    <arg name="properties" type="a{sv}"/>
</signal>
<signal name="ModemRemoved">
    <arg name="path" type="o"/>
</signal>
</interface>;

const ManagerProxy = Gio.DBusProxy.makeProxyWrapper(ManagerInterface);

function Manager() {
    return new ManagerProxy(Gio.DBus.system, BUS_NAME, '/');
}

const ofonoManager = new Lang.Class({
    Name: 'ofonoManager',
    Extends: PanelMenu.SystemStatusButton,
    run: false,
    _menuopen: false,

    _init: function() {
	this.parent('network-cellular-umts-symbolic', _("ofono"));
	this.ofonoVanished();
	this.watch = Gio.DBus.system.watch_name(BUS_NAME, Gio.BusNameWatcherFlags.NONE,
						Lang.bind(this, this.ofonoAppeared),
						Lang.bind(this, this.ofonoVanished) );
    },

    ofonoAppeared: function() {
	if (this._no_ofono) {
	    this._no_ofono.destroy();
	    this._no_ofono = null;
	}

	this.manager = new Manager();
	this.modems = {};

	this.manager_sig_modemadd = this.manager.connectSignal('ModemAdded', Lang.bind(this, function(proxy, sender,[path, properties]) {
	    if (Object.getOwnPropertyDescriptor(this.modems, path)) {
		return;
	    }

	    /*Do not add test modems */
	    if (properties.Type.deep_unpack() == "test")
		    return;

	    this.no_modems(false);

	    this.modems[path] = {modem: new ModemItem(path, properties), sep: new PopupMenu.PopupSeparatorMenuItem()};
	    this.menu.addMenuItem(this.modems[path].modem.CreateMenuItem());
	    this.menu.addMenuItem(this.modems[path].sep);
	}));

	this.manager_sig_modemrem = this.manager.connectSignal('ModemRemoved', Lang.bind(this, function(proxy, sender, path) {
	    if (!Object.getOwnPropertyDescriptor(this.modems, path)) {
		return;
	    }

	    this.modems[path].modem.CleanUp();
	    this.modems[path].sep.destroy();
	    delete this.modems[path];


	    let mod_list = Object.getOwnPropertyNames(this.modems)
	    if (mod_list.length == 0) {
		this.no_modems(true);
		return;
	    }

	    this.update_icon();
	}));

	this.manager.GetModemsRemote(Lang.bind(this, this.get_modems));
    },

    ofonoVanished: function() {

	if (this.modems) {
	    for each (let path in Object.keys(this.modems)) {
		this.modems[path].modem.CleanUp();
		delete this.modems[path];
            }

	    delete this.modems;
	}

	this.setIcon('network-cellular-umts-symbolic');

	this.no_modems(false);

	if (this._no_ofono)
	    return;

	this._no_ofono = new PopupMenu.PopupMenuSection();
	let no_ofonod = new PopupMenu.PopupMenuItem(_("oFono is not running"),
			{ reactive: false, style_class: 'popup-inactive-menu-item' });

	this._no_ofono.addMenuItem(no_ofonod);
	this.menu.addMenuItem(this._no_ofono);
    },

    get_modems: function(result, excp) {
	/* result contains the exported Modems.
	 * modems is a array: a(oa{sv}), each element consists of [path, Properties]
	*/
	if (result == null)
	    return;

	let modem_array = result[0];

	if (modem_array.length == 0) {
	    this.no_modems(true);
	    return;
	} else
	    this.no_modems(false);

	for each (let [path, properties] in modem_array) {
	    if (Object.getOwnPropertyDescriptor(this.modems, path)) {
		this.modems[path].modem.UpdateProperties(properties);
	    } else {
		/* Do not Add test modems */
		if (properties.Type.deep_unpack() == "test")
		    continue;

		this.modems[path] = { modem: new ModemItem(path, properties), sep: new PopupMenu.PopupSeparatorMenuItem()};
		this.menu.addMenuItem(this.modems[path].modem.CreateMenuItem());
		this.menu.addMenuItem(this.modems[path].sep);
	    }
	}

	if (Object.keys(this.modems).length == 0)
	    this.no_modems(true);
    },

    no_modems: function(add) {
	if (add) {
	    this.no_modems_item = new PopupMenu.PopupMenuSection();
	    let no_modem_label = new PopupMenu.PopupMenuItem(_("No Modems detected"),
				{ reactive: false, style_class: 'popup-inactive-menu-item' });

	    this.no_modems_item.addMenuItem(no_modem_label);
	    this.menu.addMenuItem(this.no_modems_item);

	    this.update_icon();
	} else {
	    if (this.no_modems_item) {
		this.no_modems_item.destroy();
		this.no_modems_item = null;
	    }
	}
    },

    update_icon:function() {
	let _status = State.DISABLED;

	if (this.modems) {
	    for each (let path in Object.keys(this.modems)) {
		if (this.modems[path].modem.status > _status)
		    _status = this.modems[path].modem.status;
            }
	}

	_extension.setIcon(status_to_icon(_status));
    }
})

function init() {
    //Nothing to do here.
}

function enable() {
    _extension = new ofonoManager();
    Main.panel.addToStatusArea('oFono', _extension);
}

function disable() {
    Gio.DBus.system.unwatch_name(_extension.watch);
    _extension.destroy();

    _extension = null;
}
