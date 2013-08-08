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
const Gettext = imports.gettext.domain('gnome-extension-ofono');
const Clutter = imports.gi.Clutter;

const ModalDialog = imports.ui.modalDialog;
const ShellEntry = imports.ui.shellEntry;
const MessageTray = imports.ui.messageTray;
const CheckBox = imports.ui.checkBox;
const Util = imports.misc.util;
const _ = Gettext.gettext;

const BUS_NAME = 'org.ofono';
const DIALOG_TIMEOUT = 120*1000;

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
	return 'network-cellular-signal-none-symbolic';
    case State.PINREQUIRED:
    case State.PUKREQUIRED:
	return 'dialog-password-symbolic';
    case State.AVAILABLE:
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
	return 'network-cellular-signal-none-symbolic';
    }
}

/* UI PIN DIALOG SECTION */
const PinDialog = new Lang.Class({
    Name: 'PinDialog',
    Extends: ModalDialog.ModalDialog,
    _init: function(sim_manager, pin_type, retries) {
	this.parent({ styleClass: 'prompt-dialog' });
	this.sim_manager = sim_manager;
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
					  text: _("Authentication required to access SIM")});

        this.messageBox.add(subjectLabel,
                       { y_fill:  false,
                         y_align: St.Align.START });

	/* Add a Description Label in the Message */
        this.descriptionLabel = new St.Label({ style_class: 'prompt-dialog-description', text: "" });
        this.messageBox.add(this.descriptionLabel, { y_fill: true, y_align: St.Align.MIDDLE, expand: true });

	/* Set the description lable according to the pin type */
	if (pin_type == "pin")
	    this.descriptionLabel.text = _("PIN required to unlock SIM.");
	else if (pin_type == "puk")
	    this.descriptionLabel.text = _("PUK required to unlock PIN");
	else
	    this.descriptionLabel.text = pin_type + _("required to access SIM");

	/* Create a box container */
        this.pinBox = new St.BoxLayout({ vertical: false });
	this.messageBox.add(this.pinBox, { y_fill: true, y_align: St.Align.MIDDLE, expand: true });

	/* PIN Label */
        this.pinLabel = new St.Label(({ style_class: 'prompt-dialog-description', text: ""}));
        this.pinBox.add(this.pinLabel,  { y_fill: false, y_align: St.Align.START });

	/* Set the description lable according to the pin type */
	if (pin_type == "pin")
	    this.pinLabel.text = _("PIN ");
	else if (pin_type == "puk")
	    this.pinLabel.text = _("PUK        ");
	else if (pin_type == "pin2")
	    this.pinLabel.text = _("PIN2 ");
	else if (pin_type == "puk2")
	    this.pinLabel.text = _("PUK2        ");
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
		this.newpinLabel.text = _("New PIN ");
	    else if (pin_type == "puk2")
		this.newpinLabel.text = _("New PIN2 ");

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
	    this.retryLabel.text = retries[pin_type] + _(" attempts left to Unlock.");

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
	    this.sim_manager.EnterPinRemote(this.pin_type,
					    this._pinEntry.get_text(),
					    Lang.bind(this, function(result, excp) {
						this.destroy();
					    }));
	}

	if (this.pin_type == 'puk' || this.pin_type == 'puk2') {
	    this.sim_manager.ResetPinRemote(this.pin_type,
					    this._pinEntry.get_text(),
					    this._newpinEntry.get_text(),
					    Lang.bind(this, function(result, excp) {
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

/*-----DBUS INTERFACE DEFINITIONS START-----*/

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

function Modem(path) {
    return new ModemProxy(Gio.DBus.system, BUS_NAME, path);
}

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

/*-----DBUS INTERFACE DEFINITIONS STOP-----*/

const ContextItem = new Lang.Class({
    Name: 'ContextItem',

    _init: function(path, properties, connmgr) {
	this.path	= path;
	this.modem	= connmgr.modem;
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
	    this.name = _("New Internet Connection");
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

	let title = ("%s").format(this.modem.name) + _("- Unable to connect to the network");

        let icon = new St.Icon({ icon_name: 'network-cellular-signal-none-symbolic',
                                 icon_size: MessageTray.NOTIFICATION_ICON_SIZE });

        this.notification = new MessageTray.Notification(this._source, title, null,
                                                            { icon: icon, customContent:true });

	this.notification.addBody(("%s").format(this.modem.name) + _("is unable to connect to the network. Make sure you configured the connection correctly or press 'Configure' to configure again."));
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

	let title = ("%s ").format(this.modem.name) + _("is not online");
	let text = ("%s").format(this.modem.name) +
	    _("is not connected to the network. Enable Cellular in Connection Manager to activate this connection.");

        let icon = new St.Icon({ icon_name: 'network-cellular-signal-none-symbolic',
                                 icon_size: MessageTray.NOTIFICATION_ICON_SIZE });

        let _notification = new MessageTray.Notification(this._source, title, text,
                                                            { icon: icon });
        _notification.setUrgency(MessageTray.Urgency.HIGH);
        _notification.setTransient(true);
        this._source.notify(_notification);
    },

    Destroy: function() {
	if (this.prop_sig)
	    this.proxy.disconnectSignal(this.prop_sig);

	if (this.notification)
	    this.notification.destroy();

	if (this._source)
            this._source = null;

	this.context_section.destroy();
    }
});

const ConnectionManager = new Lang.Class({
    Name: 'ConnectionManager',

    _init: function(modem, path) {
	this.modem = modem;

	this.proxy = new ConnectionManagerProxy(Gio.DBus.system, BUS_NAME, path);
	this.internet_context	= null;

	this.roaming_sw		= null;
	this.roaming_allowed	= false;
	this.bearer		= "none";
	this.attached		= false;

	this.proxy.GetPropertiesRemote(Lang.bind(this, this.GetProperties));
	this.proxy.connectSignal('PropertyChanged', Lang.bind(this, this.PropertyChanged));

	this.ConfigContextMenu();

	this.proxy.GetContextsRemote(Lang.bind(this, this.GetContexts));
	this.proxy.connectSignal('ContextAdded', Lang.bind(this, this.ContextAdded));
	this.proxy.connectSignal('ContextRemoved', Lang.bind(this, this.ContextRemoved));
    },

    ConfigContextMenu: function() {
	this.addcontextitem = new PopupMenu.PopupBaseMenuItem();

	this.add_label = new St.Label();
	this.add_label.text = _("Configure this Connection");
	this.addcontextitem.addActor(this.add_label);

	this.addcontextitem.connect('activate', Lang.bind(this, this.config_context));

	this.modem.AddConnectionSection.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	this.modem.AddConnectionSection.addMenuItem(this.addcontextitem);
    },

    config_context: function() {
	if (this.internet_context) {
	    Util.spawn(['ofono-wizard', '-p', this.modem.path]);
	}else {
	    this.proxy.AddContextRemote("internet", Lang.bind(this, function(result, excp){
	    }));
	}
    },

    GetContexts: function(result, exception) {
	/* result contains the exported Contexts.
	 * contexts is a array of path and dict a{sv}.
	 */
	if (result == null) {
	    this.proxy.AddContextRemote("internet", Lang.bind(this, function(result, excp){
	    }));
	    return;
	}

	let contexts = result[0];

	for each (let [path, properties] in contexts) {
	    if ((properties.Type.deep_unpack() != "internet"))
		continue;

	    this.internet_context = new ContextItem(path, properties, this);
	    this.modem.ContextSection.addMenuItem(this.internet_context.CreateContextItem());
	    return;
	}

	if (!this.internet_context) {
	    this.proxy.AddContextRemote("internet", Lang.bind(this, function(result, excp){
	    }));
	}
    },

    ContextAdded: function(proxy, sender,[path, properties]) {
	if (this.internet_context)
	    return;

	if ((properties.Type.deep_unpack() != "internet"))
	    return;

	this.internet_context = new ContextItem(path, properties, this);
	this.modem.ContextSection.addMenuItem(this.internet_context.CreateContextItem());
    },

    ContextRemoved:function(proxy, sender, path) {
	if (this.internet_context.path != path)
	    return;

	this.internet_context.Destroy();
	this.internet_context = null;

	this.proxy.AddContextRemote("internet", Lang.bind(this, function(result, excp){
	}));
    },

    GetProperties: function(result, exception) {
	/* result contains the exported Properties.
	 * properties is a dict a{sv}. They can be accessed by
	 * properties.<Property Name>.deep_unpack() which unpacks the variant.
	 */

	let properties = result[0];

	if (properties.Attached)
	    this.attached = properties.Attached.deep_unpack();

	if (properties.Bearer)
	    this.bearer =  properties.Bearer.deep_unpack() ;

	if (properties.RoamingAllowed) {
	    this.roaming_allowed = properties.RoamingAllowed.deep_unpack();
	    this.set_roaming_switch();
	}

	this.modem.update_status();
    },

    PropertyChanged: function(proxy, sender,[property, value]) {
	if (property == 'Attached') {
	    this.attached = value.deep_unpack();
	} else if (property == 'Bearer') {
	    this.bearer = value.deep_unpack();
	} else if (property == 'RoamingAllowed') {
	    this.roaming_allowed = value.deep_unpack();
	    this.set_roaming_switch();
	}

	this.modem.update_status();
    },

    set_roaming_switch: function() {
	if (!this.roaming_sw) {
	    this.roaming_sw = new PopupMenu.PopupSwitchMenuItem(_("Allow Roaming"), this.roaming_allowed);

	    this.roaming_sw.connect('toggled',  Lang.bind(this, function(item, state) {
		let val = GLib.Variant.new('b', state);
		this.proxy.SetPropertyRemote('RoamingAllowed', val);
	    }));

	    this.modem.RoamingSection.addMenuItem(this.roaming_sw);
	}

	this.roaming_sw.setToggleState(this.roaming_allowed);
    },

    Destroy: function() {
	if (this.roaming_sw) {
	    this.roaming_sw.disconnectAll();
	    this.roaming_sw.destroy();
	    this.roaming_sw = null;
	}

	if (this.addcontextitem) {
	    this.addcontextitem.disconnectAll();
	    this.addcontextitem.destroy();
	}

	if (this.internet_context)
	    this.internet_context.Destroy();
    }
});

const SimManager = new Lang.Class({
    Name: 'SimManager',

    _init: function(modem, path) {
	this.modem = modem;

	this.proxy = new SimManagerProxy(Gio.DBus.system, BUS_NAME, path);

	this.sim_present	= false;
	this.sim_pin		= null;
	this.sim_pin_retry	= null;
	this.sim_pin_display	= false;

	this.proxy.GetPropertiesRemote(Lang.bind(this, this.GetProperties));
	this.proxy.connectSignal('PropertyChanged', Lang.bind(this, this.PropertyChanged));
    },

    GetProperties: function(result, exception) {
	/* result contains the exported Properties.
	 * properties is a dict a{sv}. They can be accessed by
	 * properties.<Property Name>.deep_unpack() which unpacks the variant.
	 */

	let properties = result[0];

	if (properties.Present)
	    this.sim_present = properties.Present.deep_unpack();

	if (properties.PinRequired)
	    this.sim_pin = properties.PinRequired.deep_unpack();

	if (properties.Retries)
	    this.sim_pin_retry = properties.Retries.deep_unpack();

	this.enter_pin();

	this.modem.update_status();
    },

    PropertyChanged: function(proxy, sender,[property, value]) {
	if (property == 'Present') {
	    this.sim_present = value.deep_unpack();
	    this.enter_pin();
	} else if (property == 'PinRequired') {
	    this.sim_pin = value.deep_unpack();
	    this.enter_pin();
	} else if (property == 'Retries') {
	    this.sim_pin_retry = value.deep_unpack();
	    this.enter_pin();
	}

	this.modem.update_status();
    },

    enter_pin: function() {
	if (!this.sim_present || !this.sim_pin || !this.sim_pin_retry ||
	    (this.sim_pin == 'none') || this.sim_pin_display)
	    return;

	if (this.sim_pin_retry[this.sim_pin] > 0) {
	    this.sim_pin_display = true;
	    this.dialog = new PinDialog(this.proxy, this.sim_pin, this.sim_pin_retry);
	    this.dialog.connect('destroy', Lang.bind(this, function(){
		this.sim_pin_display = false;
	    }));
	}
    },

    Destroy: function() {
	if (this.dialog)
	    this.dialog.destroy();
    }
});

const ModemItem = new Lang.Class({
    Name: 'ModemItem',

    _init: function(path, properties) {
	this.path	= path;
	this.proxy	= new Modem(path);
	this.contexts	= {};

	/* Create a Menu Item for this modem. */
	this.Item  = new PopupMenu.PopupMenuSection();

	this.PowerSection = new PopupMenu.PopupMenuSection();
	this.StatusSection = new PopupMenu.PopupMenuSection();
	this.RoamingSection = new PopupMenu.PopupMenuSection();
	this.ContextSection = new PopupMenu.PopupMenuSection();
	this.AddConnectionSection = new PopupMenu.PopupMenuSection();

	this.Item.addMenuItem(this.PowerSection);
	this.Item.addMenuItem(this.StatusSection);
	this.Item.addMenuItem(this.RoamingSection);
	//this.Item.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	this.Item.addMenuItem(this.ContextSection);
	this.Item.addMenuItem(this.AddConnectionSection);

	this.powered		= properties.Powered.deep_unpack();
	this.online		= properties.Online.deep_unpack();
	this.type		= properties.Type.deep_unpack();
	this.interfaces		= null;
	this.status		= State.DISABLED;
	this.conn_manager	= null;
	this.sim_manager	= null;

	if (properties.Name)
	    this.name = properties.Name.deep_unpack();
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

	this.proxy.connectSignal('PropertyChanged', Lang.bind(this, this.ModemPropertyChanged));
    },

    ModemPropertyChanged: function(proxy, sender,[property, value]) {
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
    },

    CreateMenuItem: function() {
	this.sw = new PopupMenu.PopupSwitchMenuItem(this.name, this.powered);

	this.sw.connect('toggled',  Lang.bind(this, function(item, state) {
	    let val = GLib.Variant.new('b', state);
	    this.proxy.SetPropertyRemote('Powered', val);
	}));

	this.PowerSection.addMenuItem(this.sw);

	this.status_section = new PopupMenu.PopupBaseMenuItem();

	this.label = new St.Label();
	this.label.text = _("Status:");
	this.status_section.addActor(this.label);

	this.status_label = new St.Label();
	this.status_label.text = status_to_string(this.status);
	this.status_section.addActor(this.status_label, { align: St.Align.END });

	this.StatusSection.addMenuItem(this.status_section);

	this.update_status();
	this.status_section.connect('activate', Lang.bind(this, this.StatusClicked));

	return this.Item;
    },

    StatusClicked: function() {
	if (this.status == State.PINREQUIRED || this.status == State.PUKREQUIRED) {
	    if (!this.sim_manager)
		return;

	    this.sim_manager.enter_pin();
	}
    },

    set_powered: function(powered) {
	this.powered = powered;
	if (this.sw)
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
	if (this.sw)
	    this.sw.label.text = this.name;
    },

    set_model: function(model) {
	this.model = model;
	if (this.manufacturer)
	    this.name = this.manufacturer + '-' + this.model;
	else
	    this.name = "Modem" + '-' + this.model;
	if (this.sw)
	    this.sw.label.text = this.name;
    },

    set_name: function(name) {
	this.name = name;
	if (this.sw)
	    this.sw.label.text = this.name;
    },

    set_interfaces: function(interfaces) {
	if (this.sim_manager == null && interfaces.indexOf('org.ofono.SimManager') != -1) {
	    this.sim_manager = new SimManager(this, this.path);
	}

	if (this.conn_manager == null && interfaces.indexOf('org.ofono.ConnectionManager') != -1) {
	    this.conn_manager = new ConnectionManager(this, this.path);
	}

	if (this.conn_manager && interfaces.indexOf('org.ofono.ConnectionManager') == -1) {
	    this.conn_manager.Destroy();
	    this.conn_manager = null;
	}
    },

    update_status: function() {
	if (this.powered == false) {
	    this.status = State.DISABLED;
	}else {
	    if (this.sim_manager && this.sim_manager.sim_present == false) {
		this.status = State.NOSIM;
	    } else {
		if (this.sim_manager && this.sim_manager.sim_pin && this.sim_manager.sim_pin != "none") {
		    /* Handle all values? */
		    if (this.sim_manager.sim_pin == "pin" || this.sim_manager.sim_pin == "pin2")
			this.status = State.PINREQUIRED;
		    else if (this.sim_manager.sim_pin == "puk" || this.sim_manager.sim_pin == "puk2")
			this.status = State.PUKREQUIRED;
		    else
			this.status = State.PINREQUIRED;
		} else {
		    if (this.conn_manager && this.conn_manager.attached == true) {
			if (this.conn_manager.bearer == 'gsm')
			    this.status = State.GSM;
			else if (this.conn_manager && this.conn_manager.bearer == 'edge')
			    this.status = State.EDGE;
			else if (this.conn_manager && this.conn_manager.bearer == 'umts')
			    this.status = State.UMTS;
			else if (this.conn_manager &&
				 (this.conn_manager.bearer == 'hsdpa' ||
				 this.conn_manager.bearer == 'hsupa' ||
				 this.conn_manager.bearer == 'hspa'))
			    this.status = State.HSPA;
			else if (this.conn_manager && this.conn_manager.bearer == 'lte')
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

	OfonoMgr.UpdateIcon();
    },

    Destroy: function() {
	if (this.sim_manager) {
	    this.sim_manager.Destroy();
	    this.sim_manager = null;
	}

	if (this.conn_manager) {
	    this.conn_manager.Destroy();
	    this.conn_manager = null;
	}

	if (this.Item) {
	    this.sw.disconnectAll();
	    this.sw.destroy();
	    this.PowerSection.destroy();

	    this.status_section.disconnectAll();
	    this.status_section.destroy();
	    this.StatusSection.destroy();

	    this.RoamingSection.destroy();
	    this.ContextSection.destroy();
	    this.AddConnectionSection.destroy();

	    this.Item.destroy();

	    this.Item = null;
	}
    }
});

let start_listening = false;

const OfonoManager = new Lang.Class({
    Name: 'OfonoManager',

    _init: function() {
	this.modems = {};
	this._added = false;

	if (!OfonoMenu)
	    OfonoMenu = new PanelMenu.SystemStatusButton('network-cellular-signal-none-symbolic', _("Ofono"));

	this.manager = new Manager();
	start_listening = false;

	this.manager.GetModemsRemote(Lang.bind(this, this.ManagerGetModems));
    },

    StartListening: function() {
	if (start_listening)
	    return;

	start_listening = true;
	this.manager.connectSignal('ModemAdded', Lang.bind(this, this.ManagerModemAdded));
	this.manager.connectSignal('ModemRemoved', Lang.bind(this, this.ManagerModemRemoved));
    },

    ManagerGetModems: function(result, excp) {
	/* result contains the exported Modems.
	 * modems is a array: a(oa{sv}), each element consists of [path, Properties]
	*/

	if (excp || !result) {
	    this.StartListening();
	    return;
	}

	let modem_array = result[0];

	if (modem_array.length == 0) {
	    this.StartListening();
	    return;
	}

	for each (let [path, properties] in modem_array) {
	    if (Object.getOwnPropertyDescriptor(this.modems, path)) {
		this.modems[path].modem.UpdateProperties(properties);
	    } else {
		/* Do not Add test or hfp modems */
		if (properties.Type.deep_unpack() != "hardware")
		    continue;

		this.modems[path] = { modem: new ModemItem(path, properties),
				      seperator: new PopupMenu.PopupSeparatorMenuItem()};

		if (Object.keys(this.modems).length > 1)
		    OfonoMenu.menu.addMenuItem(this.modems[path].separator);

		OfonoMenu.menu.addMenuItem(this.modems[path].modem.CreateMenuItem());
	    }
	}

	if (Object.keys(this.modems).length > 0 && !this._added) {
	    this._added = true;
	    Main.panel.addToStatusArea('Ofono', OfonoMenu);
	}

	this.StartListening();
    },

    ManagerModemAdded: function(proxy, sender, [path, properties]) {
	if (!start_listening)
	    return;

	if (Object.getOwnPropertyDescriptor(this.modems, path)) {
	    return;
	}

	/*Do not add test or hfp modems */
	if (properties.Type.deep_unpack() != "hardware")
	    return;

	if (!OfonoMenu)
	    OfonoMenu = new PanelMenu.SystemStatusButton('network-cellular-signal-none-symbolic', _("Ofono"));

	this.modems[path] = { modem: new ModemItem(path, properties),
			      seperator: new PopupMenu.PopupSeparatorMenuItem()};

	if (Object.keys(this.modems).length > 1)
	    OfonoMenu.menu.addMenuItem(this.modems[path].separator);

	OfonoMenu.menu.addMenuItem(this.modems[path].modem.CreateMenuItem());

	if (!this._added) {
	    this._added = true;
	    Main.panel.addToStatusArea('Ofono', OfonoMenu);
	}
    },

    ManagerModemRemoved: function(proxy, sender, path) {
	if (!Object.getOwnPropertyDescriptor(this.modems, path)) {
	    return;
	}

	this.modems[path].modem.Destroy();
	this.modems[path].seperator.destroy();
	delete this.modems[path];

	if (!Object.keys(this.modems).length) {
	    OfonoMenu.destroy();
	    OfonoMenu = null;
	    this._added = false;
	}
    },

    UpdateIcon:function() {
	let _status = State.DISABLED;

	if (this.modems) {
	    for each (let path in Object.keys(this.modems)) {
		if (this.modems[path].modem.status > _status)
		    _status = this.modems[path].modem.status;
            }
	}

	if (OfonoMenu)
	    OfonoMenu.setIcon(status_to_icon(_status));
    },

    Destroy: function() {
        let path;
        let modems = Object.getOwnPropertyNames(this.modems);
	for each (path in modems) {
            this.modems[path].modem.Destroy();
	        delete this.modems[path];
        }

	if (OfonoMenu) {
	    OfonoMenu.destroy();
	    OfonoMenu = null;
	}
    }
});

let OfonoMgr;
let OfonoMenu;
let OfonoWatch;

function OfonoAppeared() {
    if (OfonoMgr)
	return;

    OfonoMgr = new OfonoManager();
}

function OfonoVanished() {
    if (OfonoMgr) {
        OfonoMgr.Destroy();
	OfonoMgr = null;
    }
}

function init() {
}

function enable() {
    if (!OfonoWatch) {
	OfonoWatch = Gio.DBus.system.watch_name(BUS_NAME,
					    Gio.BusNameWatcherFlags.NONE,
					    OfonoAppeared,
					    OfonoVanished);
    }
}

function disable() {
    OfonoVanished();

    if (OfonoWatch) {
	Gio.DBus.system.unwatch_name(OfonoWatch);
	OfonoWatch = null;
    }
}
