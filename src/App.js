import React, { Component } from 'react';
import './App.css';
import PropTypes from 'prop-types';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Icon from '@material-ui/core/Icon';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import 'typeface-roboto';
import InputBase from '@material-ui/core/InputBase';
import { fade } from '@material-ui/core/styles/colorManipulator';
import { withStyles } from '@material-ui/core/styles';
import MenuIcon from '@material-ui/icons/Menu';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import FolderIcon from '@material-ui/icons/Folder';
import Grid from '@material-ui/core/Grid';
import CardContent from '@material-ui/core/CardContent';
import Button from '@material-ui/core/Button';
import DeleteIcon from '@material-ui/icons/Delete';
import Dropzone from 'react-dropzone';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import iconv from 'iconv-lite';
import packageJson from '../package.json';
import VideoPlayer from './player';
import chardet from 'chardet';
import arrayBufferToBuffer from 'arraybuffer-to-buffer';
import subsrt from 'subsrt';
import smi2vtt from 'smi2vtt/dist/parse';
import fileDownload from 'js-file-download';

// Data Structure
const DB_VERSION = 1;            // must be incremented by 1 if you changed data structure
const DB_INFO_FILENAME = 'dbInfo.json';


// constants
const ALIASES_FILENAME = 'aliases.json';
const ORIG_SUBS_FILENAME = 'origSubs.json';
const VTTS_FILENAME = 'vtts.json';
const UPDATE_ALIAS_DELAY = 2;   // the time for which postpone remote update. (sec)
const PAGE_SIZE = 50;     // # of items to fetch at once


// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
SCOPES += ' https://www.googleapis.com/auth/photoslibrary.readonly';

// video resolutions
// Video streaming is not officially supported for now.
// The following is a trick from Picasa era.
// '=m37' (1080p)
// '=m22' (720p)
// '=m18' (360p)
// more info: https://wordpress.org/support/topic/google-photos-videos-not-playing-in-any-lightbox-type/    // server part
const resolutions = [
  {postfix: '=m37', label: '1080p'},
  {postfix: '=m22', label: '720p'},
  {postfix: '=m18', label: '360p'},
];

class LogoutDialog extends React.Component {
  state = {
    open: false,
  };

  componentDidMount = () => this.props.onRef(this)
  handleClickOpen = () => this.setState({ open: true })
  handleClose = () => this.setState({ open: false })
  handleYes = () => {
    const app = this.props.app;
    this.setState({ open: false });
    app.initUserVars();
    app.gapi.auth2.getAuthInstance().signOut();
  }

  render() {
    return (
      <Dialog
        open={this.state.open}
        onClose={this.handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Logout?"}</DialogTitle>
        <DialogContent>
          {/* <DialogContentText id="alert-dialog-description">
            -
          </DialogContentText> */}
        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleYes} color="primary">
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}

const topBarStyles = theme => ({
  root: {
    width: '100%',
  },
  grow: {
    flexGrow: 1,
  },
  menuButton: {
    marginLeft: -12,
    marginRight: 20,
  },
  title: {
    display: 'none',
    [theme.breakpoints.up('sm')]: {
      display: 'block',
    },
  },
  search: {
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: fade(theme.palette.common.white, 0.15),
    '&:hover': {
      backgroundColor: fade(theme.palette.common.white, 0.25),
    },
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      marginLeft: theme.spacing.unit,
      width: 'auto',
    },
  },
  searchIcon: {
    width: theme.spacing.unit * 9,
    height: '100%',
    position: 'absolute',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRoot: {
    color: 'inherit',
    width: '100%',
  },
  inputInput: {
    paddingTop: theme.spacing.unit,
    paddingRight: theme.spacing.unit,
    paddingBottom: theme.spacing.unit,
    paddingLeft: theme.spacing.unit * 10,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      width: 120,
      '&:focus': {
        width: 200,
      },
    },
  },
});

class TopBar extends Component {
  handleTopLeft = () => {
    const app = this.props.app;
    if(app.state.curPage === 'main') {
      this.logoutDialog.setState({open: true});
    } else if(app.state.curPage === 'album') {
      app.changePage('main');
    } else if(app.state.curPage === 'play') {
      app.changePage('album');
    }
  }

  handleTitle = event => {
    const alias = event.target.value;
    const app = this.props.app;
    const curItem = app.state.curItem;

    // cancel previous timer
    if(this.aliasTimer)   clearTimeout(this.aliasTimer);

    // set new one
    this.aliasTimer = setTimeout(() => {
      let aliases = {};
      aliases[curItem.id] = alias || curItem.filename;
      app.updateAliases(aliases);

      // reinit
      this.aliasTimer = null;
    }, UPDATE_ALIAS_DELAY*1000);
  }

  render = () => {
    const {classes} = this.props;
    const app = this.props.app;
  
    // set title, top-left icon
    let title, topLeft;
    if(app.state.curPage === 'main') {
      const auth2 =  app.gapi.auth2.getAuthInstance();
      title = (
        <Typography variant="h6" color="inherit" noWrap>
          {auth2.currentUser.get().getBasicProfile().getEmail()} ({app.state.albums.length})
        </Typography>
      );
      topLeft = <MenuIcon />;
    } else if(app.state.curPage === 'album') {
      title = (
        <Typography variant="h6" color="inherit" noWrap>
          {app.state.curAlbum.title} ({app.state.mediaItems.length})
        </Typography>
      );
      topLeft = <Icon>arrow_back</Icon>;
    } else if(app.state.curPage === 'play') {
      // curItem may not set in the first place
      if(app.state.curItem) {
        const curItem = app.state.curItem;
        const aliasOrTitle = app.state.aliases[curItem.id] || app.state.curItem.filename;
        title = (
          <InputBase
            defaultValue={aliasOrTitle}
            fullWidth
            style={{color:'inherit'}}
            onChange={event => this.handleTitle(event)}
            placeholder={app.state.curItem.filename}
          />
        );
      }
      topLeft = <Icon>arrow_back</Icon>;
    }
    
    return (
      <div className={classes.root}>
        <LogoutDialog onRef={d => {this.logoutDialog = d}} app={this.props.app} />
        <AppBar position="fixed">
          <Toolbar>
            <IconButton
              className={classes.menuButton}
              color="inherit"
              aria-label="Open drawer"
              onClick={() => this.handleTopLeft()}
            >
              {topLeft}
            </IconButton>
            {title}
            {/* <div className={classes.grow} />
            <div className={classes.search}>
              <div className={classes.searchIcon}>
                <SearchIcon />
              </div>
              <InputBase
                placeholder="Search…"
                classes={{
                  root: classes.inputRoot,
                  input: classes.inputInput,
                }}
              />
            </div> */}
          </Toolbar>
        </AppBar>
      </div>
    );
  }
}

TopBar.propTypes = {
  classes: PropTypes.object.isRequired,
};

TopBar = withStyles(topBarStyles)(TopBar);

const appStyles = theme => ({
  root: {
    flexGrow: 1,
    maxWidth: '96vw',
  },
  demo: {
    backgroundColor: theme.palette.background.paper,
  },
  title: {
    margin: `${theme.spacing.unit * 4}px 0 ${theme.spacing.unit * 2}px`,
  },
});

class App extends Component {
  state = {
    isSignedIn: false,
    curPage: 'loading',
  }

  initUserVars = () => {
    // intermediate storage for performance
    this.albums = [];
    this.mediaItems = [];
    this.aliases = {};
    this.origSubs = {};
    this.vtts = {};

    return this.setState({
      albums: [],
      curAlbum: {},
      mediaItems: [],
      curItem: null,
      nextResIdx: 0,            // resolution index to try
      refreshPlayer: false,     // a trigger to refresh video player
      currentTime: 0,           // current playing time
      aliases: {},    // {itemId: '<alias>'}
      origSubs: {},    // {itemId: '<origSubId>'} ; original subtitles
      vtts: {},    // {itemId: '<vttId>'} ; captions
    });
  }

  componentDidMount = async () => {
    // init user variables
    await this.initUserVars();
    
    // The same as state.albums.
    // This is intermediate storage for fetching all albums.
    this.albums = [];
  
    let script;

    // google apis
    script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      this.gapi = window.gapi;
      this.gapi.load('client:auth2', async () => {
        // init
        await this.gapi.client.init({
          apiKey: packageJson.API_KEY,
          clientId: packageJson.CLIENT_ID,
          discoveryDocs: packageJson.DISCOVERY_DOCS,
          scope: SCOPES,
        });
        
        // Set listener
        this.gapi.auth2.getAuthInstance().isSignedIn.listen(this.updateSigninStatus);

        // Handle the initial sign-in state.
        this.updateSigninStatus(this.gapi.auth2.getAuthInstance().isSignedIn.get());
      });
    };
    document.body.appendChild(script);
  }

  // update data structure from old version to the current one
  updateDB = async () => {
    let dbVersion = this.dbInfo.version;

    if(dbVersion === 0) {
      let proms = [];
      // generate meta files
      proms.push(this.createFile(ALIASES_FILENAME).then(id => {
        this.aliasesId = id;
        this.aliases = {};
        return this.updateAliases({});
      }));
      proms.push(this.createFile(ORIG_SUBS_FILENAME).then(id => {
        this.origSubsId = id;
        this.origSubs = {};
        return this.updateOrigSubs({});
      }));
      proms.push(this.createFile(VTTS_FILENAME).then(id => {
        this.vttsId = id;
        this.vtts = {};
        return this.updateVtts({});
      }));
      await Promise.all(proms);

      // decompose meta.json
      const METAINFO_FILENAME = 'meta.json';
      const result = await this.listFiles(METAINFO_FILENAME);
      if(result.length > 0) {
        const metaInfoId = result[0].id;

        // extract alises
        const metaInfo = JSON.parse(await this.getFile(metaInfoId));
        let aliases = {}, isDirty = false;
        for(const itemId in metaInfo) {
          if(metaInfo[itemId].alias) {
            aliases[itemId] = metaInfo[itemId].alias;
            isDirty = true;
          }
        }
  
        // update aliases
        if(isDirty) {
          await this.updateAliases(aliases);
        }
  
        // delete meta.json
        this.delFile(metaInfoId);
      }

      // list folders
      const drive = this.gapi.client.drive;
      const response = await drive.files.list({
        q: 'mimeType="application/vnd.google-apps.folder"',
        spaces: 'appDataFolder',
        fields: 'files(id, name)',
        pageSize: 1000,
      });
      let folderNames = {};
      for(const folder of response.result.files) {
        folderNames[folder.id] = folder.name;
      }
  
      // find vtts
      let vtts = {};
      const vttFiles = await this.listFiles('captions.vtt');
      for(const vttFile of vttFiles) {
        vtts[folderNames[vttFile.parents[0]]] = vttFile.id;
      }
      await this.updateVtts(vtts);

      // increment version
      dbVersion++;
    }

    // update db info
    await this.updateDBInfo({version: dbVersion});
  }

  updateDBInfo = (toPut={}, toDel=[]) => {
    // delete
    for(const x of toDel) {
      delete this.dbInfo[x];
    }

    // put
    Object.assign(this.dbInfo, toPut);
    // this.setState({dbInfo: this.dbInfo});
    this.writeFile(this.dbInfoId, JSON.stringify(this.dbInfo));
  }

  updateAliases = (toPut={}, toDel=[]) => {
    // delete
    for(const x of toDel) {
      delete this.aliases[x];
    }

    // put
    Object.assign(this.aliases, toPut);
    this.setState({aliases: this.aliases});
    return this.writeFile(this.aliasesId, JSON.stringify(this.aliases));
  }

  updateVtts = (toPut={}, toDel=[]) => {
    // delete
    for(const x of toDel) {
      delete this.vtts[x];
    }

    // put
    Object.assign(this.vtts, toPut);
    this.setState({vtts: this.vtts});
    return this.writeFile(this.vttsId, JSON.stringify(this.vtts));
  }

  updateOrigSubs = (toPut={}, toDel=[]) => {
    // delete
    for(const x of toDel) {
      delete this.origSubs[x];
    }

    // put
    Object.assign(this.origSubs, toPut);
    this.setState({origSubs: this.origSubs});
    return this.writeFile(this.origSubsId, JSON.stringify(this.origSubs));
  }

  handleSigninClick = event => this.gapi.auth2.getAuthInstance().signIn()
  handleSignoutClick = event => this.gapi.auth2.getAuthInstance().signOut()
  handleAlbumClick = album => {
    this.getMediaItems(album.id);
    this.setState({curAlbum: album});
    this.changePage('album');
  }
  handleItemClick = item => {
    this.getMediaItem(item.id);
    this.changePage('play');
  }
  handleDelSubtitle = async () => {
    const curItemId = this.state.curItem.id;
    const origSubId = this.state.origSubs[curItemId];
    const vttId = this.state.vtts[curItemId];
    
    // delete subtitles
    if(origSubId) this.delFile(origSubId);
    if(vttId)     this.delFile(vttId);

    // unlink references
    this.updateOrigSubs({}, [curItemId]);
    this.updateVtts({}, [curItemId]);

    // update player on the fly
    if(this.state.curPage === 'play') {
      this.videoPlayer.removeSubtitle();
    }
  }
  handleDownloadSubtitle = async () => {
    const origSubId = this.state.origSubs[this.state.curItem.id];
    const origSubMeta = await this.getFileMetaInfo(origSubId);
    const origSub = Buffer.from(JSON.parse(await this.getFile(origSubId)).data);
    fileDownload(origSub, origSubMeta.name);
  }
  
  updateSigninStatus = async isSignedIn => {
    if(isSignedIn) {
      // check necessity for upgrading
      const res = await this.listFiles(DB_INFO_FILENAME);
      if(res.length > 0) {
        // found
        this.dbInfoId = res[0].id;
        let content = await this.getFile(this.dbInfoId) || "{}";
        this.dbInfo = JSON.parse(content);
        if(this.dbInfo.version === undefined) {
          this.dbInfo.version = 0;
        }
      } else {
        // not found
        this.dbInfo = {};
        this.dbInfoId = await this.createFile(DB_INFO_FILENAME);
        await this.updateDBInfo({version: 0});
      }
      if(this.dbInfo.version < DB_VERSION) {
        // update data structure
        await this.updateDB();
      }

      // fetch meta info
      let proms = [];
      proms.push(this.listFiles(ALIASES_FILENAME).then(async res => {
        this.aliasesId = res[0].id;
        this.aliases = JSON.parse(await this.getFile(this.aliasesId));
        this.setState({aliases: this.aliases});
      }));
      proms.push(this.listFiles(ORIG_SUBS_FILENAME).then(async res => {
        this.origSubsId = res[0].id;
        this.origSubs = JSON.parse(await this.getFile(this.origSubsId));
        this.setState({origSubs: this.origSubs});
      }));
      proms.push(this.listFiles(VTTS_FILENAME).then(async res => {
        this.vttsId = res[0].id;
        this.vtts = JSON.parse(await this.getFile(this.vttsId));
        this.setState({vtts: this.vtts});
      }));
      await Promise.all(proms);

      // go to main page
      this.changePage('main');

      // fetch album list
      this.getAlbums();
    } else {
      this.changePage('signin');
    }
    this.setState({isSignedIn});
  }

  changePage = page => {
    let state = {curPage: page};
    const curPage = this.state.curPage;

    // intermediate processings
    if(curPage === 'album' && page === 'main') {
      //-- from album to main --//
      state.mediaItems = [];
    } else if(curPage === 'play') {
      //-- leaving play --//
      state.curItem = null;
      state.nextResIdx = 0;
    }

    this.setState(state);
  }

  getAlbums = async pageToken => {
    let response;
    
    if(pageToken) {
      // request
      response = await this.gapi.client.request({
        path: 'https://photoslibrary.googleapis.com/v1/albums',
        method: 'GET',
        params: {pageToken, pageSize: PAGE_SIZE},
      });
    } else {
      // init
      this.albums = [];

      // request
      response = await this.gapi.client.request({
        path: 'https://photoslibrary.googleapis.com/v1/albums',
        method: 'GET',
        params: {pageSize: PAGE_SIZE},
      });
    }

    // response
    if(response.status === 200) {
      //-- success --//
      // append to previous one
      if(response.result.albums) {
        this.albums = this.albums.concat(response.result.albums);
  
        // sort
        this.albums.sort((l, r) => ('' + l.title).localeCompare(r.title));
  
        // save
        this.setState({albums: this.albums});
  
        // request next page
        if(response.result.nextPageToken) {
          this.getAlbums(response.result.nextPageToken);
        }
      }
    } else {
      //-- error --//
      console.error(response);
    }
  }

  getMediaItems = async (albumId, pageToken) => {
    let response;

    if(pageToken) {
      // request
      response = await this.gapi.client.request({
        path: 'https://photoslibrary.googleapis.com/v1/mediaItems:search',
        method: 'POST',
        params: {albumId, pageToken, pageSize: PAGE_SIZE},
      });
    } else {
      // init
      this.mediaItems = [];
      
      // request
      response = await this.gapi.client.request({
        path: 'https://photoslibrary.googleapis.com/v1/mediaItems:search',
        method: 'POST',
        params: {albumId, pageSize: PAGE_SIZE},
      });
    }

    // response
    if(response.status === 200) {
      //-- success --//
      const mediaItems = response.result.mediaItems;

      if(mediaItems) {
        // append to previous one
        this.mediaItems = this.mediaItems.concat(mediaItems);
  
        // save
        this.setState({mediaItems: this.mediaItems});
  
        // request next page
        if(response.result.nextPageToken) {
          this.getMediaItems(albumId, response.result.nextPageToken);
        }
      }
    } else {
      //-- error --//
      console.error(response);
    }
  }

  getMediaItem = async itemId => {
    const response = await this.gapi.client.request({
      path: 'https://photoslibrary.googleapis.com/v1/mediaItems/' + itemId,
      method: 'GET',
    });
    if(response.status === 200) {
      //-- success --//
      this.setState({curItem: response.result});
    } else {
      //-- error --//
      console.error(response);
    }
  }

  onDropAccepted = files => {
    const file = files[0];
    const reader = new FileReader();

    reader.onload = async event => {
      let buf = arrayBufferToBuffer(reader.result);
      const curItemId = this.state.curItem.id;
      const oldOrigSubId = this.state.origSubs[curItemId];
      const oldVttId = this.state.vtts[curItemId];
      let filename = file.name.toLowerCase();

      // upload original subtitle
      const origSubId = await this.createFile(file.name);
      await this.writeFile(origSubId, buf);
      let origSubs = {};
      origSubs[curItemId] = origSubId;
      this.updateOrigSubs(origSubs);

      // figure out encoding
      const encoding = chardet.detect(buf);
      
      // adjust encoding
      buf = iconv.decode(buf, encoding);
      
      // convert to .vtt
      let vtt;
      if(buf.toLowerCase().startsWith('<sami>')) {
        // smi
        vtt = smi2vtt(buf);
      } else {
        // assume srt
        vtt = subsrt.convert(buf, {format: 'vtt'});
      }
      
      // `subsrt` produces timestamp using comma(,). Fix it.
      vtt = vtt.replace(/([0-9]),([0-9])/g, '$1.$2');

      // upload vtt
      const vttId = await this.createFile(filename + '.vtt');
      await this.writeFile(vttId, vtt);
      let vtts = {};
      vtts[curItemId] = vttId;
      this.updateVtts(vtts);
      
      // update subtitle on the fly
      if(this.state.curPage === 'play') {
        this.videoPlayer.updateSubtitle(vtt);
      }

      // dispose of old files
      if(oldOrigSubId)  this.delFile(oldOrigSubId);
      if(oldVttId)      this.delFile(oldVttId);
    }

    reader.readAsArrayBuffer(file);
  }

  onDropRejected = files => {
    console.error('Rejected:', files);
  }

  playNextRes = async () => {
    await this.setState({nextResIdx: this.state.nextResIdx+1});
    return this.refreshPlayer();
  }

  refreshPlayer = async (currentTime=0) => {
    // unmount video player
    await this.setState({refreshPlayer: true, currentTime});

    // remount
    return this.setState({refreshPlayer: false});
  }

  listFiles = async filename => {
    const drive = this.gapi.client.drive;

    // check if the folder exists
    const response = await drive.files.list({
      q: 'name="' + filename + '"',
      spaces: 'appDataFolder',
      fields: 'files(id, parents)',
      pageSize: 1000,
    });
    if(response.status === 200) {
      return response.result.files;
    } else {
      console.error(response);
      throw new Error(response);
    }
  }

  // get the file content
  getFile = async fileId => {
    const drive = this.gapi.client.drive;
    let content='';
    
    // download
    const response = await drive.files.get({fileId, alt: 'media'});
    switch(response.status) {
      case 200:
        content = response.body;
        break;
      default:
        console.error(response);
        throw new Error(response);
    }

    return content;
  }

  // get meta data of single file
  getFileMetaInfo = async fileId => {
    const drive = this.gapi.client.drive;
    let content={};
    
    // download
    const response = await drive.files.get({fileId});
    switch(response.status) {
      case 200:
        content = JSON.parse(response.body);
        break;
      default:
        console.error(response);
        throw new Error(response);
    }

    return content;
  }

  createFile = async filename => {
    const drive = this.gapi.client.drive;

    const response = await drive.files.create({
      name: filename,
      parents: ['appDataFolder'],
    });
    switch(response.status) {
      case 200:
        return response.result.id;
      default:
        console.error(response);
        throw new Error(response);
    }
  }

  writeFile = async (fileId, body) => {
    const response = await this.gapi.client.request({
      path: '/upload/drive/v3/files/' + fileId,
      method: 'PATCH',
      params: {
        uploadType: 'media'
      },
      body,
    });
    if(response.status !== 200) {
      console.error(response);
      throw new Error(response);
    }
  }

  delFile = async fileId => {
    const response = await this.gapi.client.request({
      path: '/drive/v3/files/' + fileId,
      method: 'DELETE',
    });
    if(Math.floor(response.status/100) !== 2 && response.status !== 404) {
      console.error(response);
      throw new Error(response);
    }
  }

  render = () => {
    const { classes } = this.props;
    let content;

    if(this.state.curPage === 'loading') {
      content = (<div>Loading</div>);
    } else if(this.state.curPage === 'signin') {
      content = (
        <Button
          variant="outlined"
          color="primary"
          onClick={() => this.handleSigninClick()}
        >
          Sign In
        </Button>
      );
    } else if(this.state.curPage === 'main') {
      //-- list albums --//
      if(this.state.albums.length > 0) {
        //-- album exists --//
        content = (
          <div>
            <TopBar app={this}/>
            <div className={classes.demo}>
              <List>
                {this.state.albums.map(album =>
                  <ListItem
                    button
                    onClick={() => this.handleAlbumClick(album)}
                    key={album.id}
                  >
                    <ListItemIcon>
                      <FolderIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={album.title}
                    />
                  </ListItem>
                )}
              </List>
            </div>
          </div>
        );
      } else {
        //-- album doesn't exists --//
        content = (
          <div>
            <TopBar app={this}/>
            <div className={classes.demo}>
              비었음.
            </div>
          </div>
        );
      }
    } else if(this.state.curPage === 'album') {
      //-- list video items --//
      let mediaItems = this.state.mediaItems;

      // filter out non-video items
      let videoItems = [];
      for(let item of mediaItems) {
        if(item.mimeType.startsWith('video')) {
          videoItems.push(item);
        }
      }

      // attach aliases
      const aliases = this.state.aliases;
      for(let item of videoItems) {
        if(item.mimeType.startsWith('video')) {
          if(item.id in aliases) {
            item.alias = aliases[item.id];
          }
        }
      }

      // sort
      videoItems.sort((l, r) => (
        '' + (l.alias || l.filename)).localeCompare(r.alias || r.filename)
      );

      // build video list rendering
      let videoListRender;
      if(videoItems.length > 0) {
        // more than 0 items
        videoListRender = (
          <List>
            {videoItems.map(item =>
              <ListItem
                button
                onClick={() => this.handleItemClick(item)}
                key={item.id}
              >
                <ListItemIcon>
                  <Icon>movie</Icon>
                </ListItemIcon>
                <ListItemText
                  primary={item.alias || item.filename}
                />
              </ListItem>
            )}
          </List>
        );
      } else {
        // no item
        videoListRender = (
          <Grid
            container
            direction='column'
            justify='space-between'
            alignItems='center'
            className={classes.gridContainer}
            style={{minHeight: '100vh'}}
          >
            <Grid item></Grid>
            <Grid item>
              <CardContent>
                <Typography gutterBottom style={{fontSize: '10vw'}}>
                  텅 비었음!
                </Typography>
              </CardContent>
            </Grid>
            <Grid item></Grid>
          </Grid>
        );
      }

      // list media items in an album
      content = (
        <div>
          <TopBar app={this} />
          <div className={classes.demo}>
            {videoListRender}
          </div>
        </div>
      );
    } else if(this.state.curPage === 'play') {
      //-- play the video --//
      if(this.state.curItem) {
        if(this.state.nextResIdx >= resolutions.length) {
          //-- no resolution available --//
          content = (
            <div>
              <TopBar app={this} />
              <div>영상 제작 중...</div>
            </div>
          );
        } else {
          //-- resolutions available --//
          // setup sources
          const item = this.state.curItem;
          let sources = [];
          for(let i=this.state.nextResIdx;i<resolutions.length;i++) {
            sources.push({
              src: item.baseUrl + resolutions[i].postfix,
              type: item.mimeType,
              label: resolutions[i].label,
            });
          }
  
          // dropzone styles
          const baseStyle = {
            // width: 480,
            height: 100,
            borderWidth: 5,
            borderColor: '#666',
            borderStyle: 'dashed',
            borderRadius: 5
          };
          const activeStyle = {
            borderStyle: 'solid',
            borderColor: '#6c6',
            backgroundColor: '#eee'
          };
  
          content = (
            <div>
              <TopBar app={this} />
              <div className={classes.demo}>
                <Grid
                  container
                  direction='row'
                  justify='space-evenly'
                  alignItems='center'
                  className={classes.gridContainer}
                >
                  <Grid item xs={12} style={{padding:10}}>
                    {!this.state.refreshPlayer &&
                      <VideoPlayer
                        onRef={v => {this.videoPlayer = v}}
                        sources={sources} app={this}
                      />
                    }
                  </Grid>
                  <Grid item xs={8} style={{padding:10}}>
                    <Dropzone
                      accept={['.smi', '.srt', '.vtt']}
                      onDropAccepted={this.onDropAccepted}
                      onDropRejected={this.onDropRejected}
                    >
                      {({getRootProps, getInputProps, isDragActive}) => {
                        let styles = {...baseStyle};
                        styles = isDragActive ? {...styles, ...activeStyle} : styles;
                        return (
                          <div
                            {...getRootProps()}
                            style={styles}
                          >
                            <input {...getInputProps()} />
                            <Grid
                              container
                              justify='center'
                              alignItems='center'
                              style={{height:'100%'}}
                            >
                              <Grid item>
                                <Typography variant="h4">
                                  <Icon fontSize='large'>subtitles</Icon>
                                  {this.state.vtts[item.id] ? '자막 있음' : '자막 끌어놓기'}
                                </Typography>
                              </Grid>
                            </Grid>
                          </div>
                        )
                      }}
                    </Dropzone>
                  </Grid>
                  <Grid item xs={4}>
                    {this.state.origSubs[item.id] &&
                      <Button
                        variant="outlined"
                        color="default"
                        onClick={() => this.handleDownloadSubtitle()}
                      >
                        <Icon className={classes.rightIcon}>archive</Icon>
                        자막 다운
                      </Button>
                    }
                    {this.state.vtts[item.id] &&
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => this.handleDelSubtitle()}
                      >
                        <DeleteIcon className={classes.rightIcon} />
                        자막 삭제
                      </Button>
                    }
                  </Grid>
                </Grid>
              </div>
            </div>
          );
        }
      } else {
        content = (
          <div>
            <TopBar app={this} />
            <div>불러오는 중</div>
          </div>
        );
      }
    }
    
    return (
      <div className="App">
        <div style={{height: 56}}></div>
        {content}
      </div>
    );
  }
}

export default withStyles(appStyles)(App);