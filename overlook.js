/*
Name:     nodejs-foscam
Source:   https://github.com/fvdm/nodejs-foscam
Feedback: https://github.com/fvdm/nodejs-foscam/issues

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>
*/

var http = require('http'),
    querystring = require('querystring'),
    fs = require('fs'),
    EventEmitter = require('events').EventEmitter;

var overlook = function () {
    var app = new EventEmitter();
    
    // defaults
    app.settings = {
        host:   '192.168.1.239',
        port:   81,
        user:   'admin',
        pass:   ''
    };
    
    // overrides
    app.setup = function( props, cb ) {
        for( var key in props ) {
            app.settings[ key ] = props[ key ];
        }
        
        if( typeof cb == 'function' ) {
            app.status( cb );
        }
    };
    
    
    // status
    app.status = function( cb ) {
        app.talk({
            path:               'get_status.cgi',
            callback:   function( data ) {
                var result = {};
                
                data = data.split('\n');
                for( var d in data ) {
                    if( data[d] !== '' ) {
                        var line = data[d].split('var ');
                        line = String(line[1]).split('=');
                        line[1] = String(line[1]).replace( /;$/, '' );
                        result[ line[0] ] = line[1].substr(0,1) == '\'' ? line[1].substr(1, line[1].length -2) : line[1];
                    }
                }
                
                if( result.alarm_status ) {
                    result.alarm_status_str = { 
                        "0" : "no alarm",
                        "1" : "motion alarm",
                        "2" : "input alarm",
                        "3" : "audio alarm"
                    }[result.alarm_status]||"unknown";
                }
                
                if( result.ddns_status ) {
                    result.ddns_status_str = {
                        "0": "No Action",
                        "1": "It's connecting...",
                        "2": "Can't connect to the Server",
                        "3": "Dyndns Succeed",
                        "4": "DynDns Failed: Dyndns.org Server Error",
                        "5": "DynDns Failed: Incorrect User or Password",
                        "6": "DynDns Failed: Need Credited User",
                        "7": "DynDns Failed: Illegal Host Format",
                        "8": "DynDns Failed: The Host Does not Exist",
                        "9": "DynDns Failed: The Host Does not Belong to You",
                        "10": "DynDns Failed: Too Many or Too Few Hosts",
                        "11": "DynDns Failed: The Host is Blocked for Abusing",
                        "12": "DynDns Failed: Bad Reply from Server",
                        "13": "DynDns Failed: Bad Reply from Server",
                        "14": "Oray Failed: Bad Reply from Server",
                        "15": "Oray Failed: Incorrect User or Password",
                        "16": "Oray Failed: Incorrect Hostname",
                        "17": "Oray Succeed",
                        "18": "Reserved",
                        "19": "Reserved",
                        "20": "Reserved",
                        "21": "Reserved"
                     }[result.ddns_status]||"unknown";
                }
                
                if( result.upnp_status ) {
                    result.upnp_status_str = {
                        "0": "No Action",
                        "1": "Succeed",
                        "2": "Device System Error",
                        "3": "Errors in Network Communication",
                        "4": "Errors in Chat with UPnP Device",
                        "5": "Rejected by UPnP Device, Maybe Port Conflict"
                    }[result.upnp_status]||"unknown";
                }
                
                cb( result );
            }
        });
    };
    
    
    // camera params
    app.camera_params = function( cb ) {
        app.talk({
            path:               'get_camera_params.cgi',
            callback:   function( data ) {
                var result = {};
                data.replace( /var ([^=]+)=([^;]+);/g, function( str, key, value ) {
                    result[ key ] = parseInt( value, 10 );
                });
                cb( result );
            }
        });
    };
    
    
    // Presets
    app.preset = {
      id2cmd: function( action, id ) {
        var cmds = {
          "set": [30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60],
          "go": [31,33,35,37,39,41,43,45,47,49,51,53,55,57,59,61]
        };
        return cmds[ action ][ id-1 ];
      },
      
      "set": function( id, cb ) {
        app.control.decoder( app.preset.id2cmd( 'set', id ), cb );
      },
      
      "go": function( id, cb ) {
        app.control.decoder( app.preset.id2cmd( 'go', id ), cb );
      }
    };
    
    
    // control
    app.control = {
        
        // pan/tilt
        decoder: function( cmd, cb ) {
                
                if( typeof cmd == 'string' && !cmd.match( /^[0-9]+$/ ) ) {
                        cmd = {
                    "up": 0,
                    "stop up": 1,
                    "down": 2,
                    "stop down": 3,
                    "left": 4,
                    "stop left": 5,
                    "right": 6,
                    "stop right": 7,
                    "center": 25,
                    "vertical patrol": 26,
                    "stop vertical patrol": 27,
                    "horizontal patrol": 28,
                    "stop horizontal patrol": 29,
                    "io output high": 94,
                    "io output low": 95
                }[cmd];
            }
            
            app.talk({
                path:           'decoder_control.cgi',
                fields:         { command: cmd },
                callback:       cb
            });
        },
        
        // camera settings
        camera: function( param, value, cb ) {
                
                // fix param
                if( typeof param == 'string' && !param.match( /^[0-9]+$/ ) ) {
                        switch( param ) {
                                
                                case 'brightness':         param = 1; break;
                                case 'contrast':           param = 2; break;
                                
                                // resolution
                                case 'resolution':
                                        param = 0;
                                        if( typeof value == 'string' && !value.match( /^[0-9]{1,2}$/ ) ) {
                                                switch( value ) {
                                                        case '320':
                                                        case '320x240':
                                                        case '320*240':
                                                                value = 8;
                                                                break;
                                                                
                                                        case '640':
                                                        case '640x480':
                                                        case '640*480':
                                                                value = 32;
                                                                break;
                                                }
                                        }
                                        break;
                                
                                case 'mode':
                                        param = 3;
                                        if( typeof value == 'string' && !value.match( /^[0-9]$/ ) ) {
                                                switch( value.toLowerCase() ) {
                                                        case '50':
                                                        case '50hz':
                                                        case '50 hz':
                                                                value = 0;
                                                                break;
                                                                
                                                        case '60':
                                                        case '60hz':
                                                        case '60 hz':
                                                                value = 1;
                                                                break;
                                                                
                                                        case 'outdoor':
                                                        case 'outside':
                                                                value = 2;
                                                                break;
                                                }
                                        }
                                        break;
                                        
                                case 'flipmirror':
                                        param = 5;
                                        if( typeof value == 'string' && !value.match( /^[0-9]$/ ) ) {
                                                switch( value.toLowerCase() ) {
                                                        case 'default':
                                                                value = 0;
                                                                break;
                                                                
                                                        case 'flip':
                                                                value = 1;
                                                                break;
                                                                
                                                        case 'mirror':
                                                                value = 2;
                                                                break;
                                                                
                                                        case 'flipmirror':
                                                        case 'flip&mirror':
                                                        case 'flip+mirror':
                                                        case 'flip + mirror':
                                                        case 'flip & mirror':
                                                                value = 3;
                                                                break;
                                                }
                                        }
                                        break;
                        }
                }
                
                // send it
                app.talk({
                        path:           'camera_control.cgi',
                        fields: {
                                param:  param,
                                value:  value
                        },
                        callback:       cb
                });
                
        }
        
    };
    
    
    // reboot
    app.reboot = function( cb ) {
        app.talk({
                path:           'reboot.cgi',
                callback:       cb
        });
    };
    
    
    // restore factory
    app.restore_factory = function( cb ) {
        app.talk({
                path:           'restore_factory.cgi',
                callback:       cb
        });
    };
    
    
    // params
    app.params = function( cb ) {
        app.talk({
                path:           'get_params.cgi',
                callback:       cb
        });
    };
    
    
    // set
    app.set = {
        
        // alias
        alias: function( alias, cb ) {
                app.talk({
                        path:           'set_alias.cgi',
                        fields:         { alias: alias },
                        callback:       cb
                });
        },
        
        // datetime
        datetime: function( props, cb ) {
                app.talk({
                        path:           'set_datetime.cgi',
                        fields:         props,
                        callback:       cb
                });
        }
        
    };
    
    
    // snapshot
    app.snapshot = function( filepath, cb ) {
        if( !cb && typeof filepath == 'function' ) {
                cb = filepath;
                filepath = false;
        }
        
        app.talk({
                path:           'snapshot.cgi',
                encoding:       'binary',
                callback:       function( bin ) {
                        if( filepath ) {
                                fs.writeFile( filepath, bin, 'binary', function( err ) {
                                        if( err ) {
                                                throw err;
//                                                cb( false );
                                        } else {
                                                cb( filepath );
                                        }
                                });
                        } else {
                                cb( bin );
                        }
                }
        })
    }
    
    
    // communicate
    app.talk = function( props ) {
        
        if( !props.fields ) {
                props.fields = {};
        }
        
        props.fields.user = app.settings.user;
        props.fields.pwd = app.settings.pass;
        var path = '/'+ props.path +'?'+ querystring.stringify( props.fields );
        
        // connect
        var req = http.request({
                
                host:           app.settings.host,
                port:           app.settings.port,
                path:           path,
                method:         'GET'
                
        }, function( response ) {
                
                // response
                response.setEncoding( props.encoding ? props.encoding : 'utf8' );
                var data = '';
                
                response.on( 'data', function( chunk ) { data += chunk });
                response.on( 'end', function() {
                        
                        if( typeof props.callback == 'function' ) {
                                data = data.trim();
                                props.callback( data );
                        }
                        
                });
                
        });
        
        // fail
        req.on( 'error', function( err ) {
                app.emit( 'connection-error', err );
        });
        
        // disconnect
        req.end();
        
    };
    
    return app;
};

// ready
module.exports = overlook;