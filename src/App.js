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

// constants
const METAINFO_FILENAME = 'meta.json';
const SUBTITLE_FILENAME = 'captions.vtt';
const UPDATE_ALIAS_DELAY = 2;   // the time for which postpone remote update. (sec)

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
    app.setAlias(app.state.curItem.id, alias || app.state.curItem.filename);
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
      const curItemMeta = app.state.metaInfo[app.state.curItem.id];
      const aliasOrTitle = (curItemMeta && curItemMeta.alias) ?
                  curItemMeta.alias : app.state.curItem.filename;
      title = (
        <InputBase
          defaultValue={aliasOrTitle}
          fullWidth
          style={{color:'inherit'}}
          onChange={event => this.handleTitle(event)}
          placeholder={app.state.curItem.filename}
        />
      );
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
    this.albums = [];
    this.mediaItems = [];
    this.setState({
      albums: [],
      curAlbum: {},
      mediaItems: [],
      curItem: null,
      nextResIdx: 0,   // resolution index to try
      refreshPlayer: false,     // a trigger to refresh video player
      subtitle: '',
      metaInfo: {},
    });
  }

  componentDidMount = () => {
    // init user variables
    this.initUserVars();
    
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
  handleDelSubtitleClick = async () => {
    const folderId = await this.getFolderId(this.state.curItem.id);
    const subtitleId = await this.getSubtitleId(folderId);
    return this.delSubtitle(subtitleId);
  }
  
  updateSigninStatus = isSignedIn => {
    if(isSignedIn) {
      // go to main page
      this.changePage('main');

      // fetch album list
      this.getAlbums();

      // fetch metaInfo
      this.getMetaInfoId().then(metaInfoId => {
        // save to class also
        this.metaInfoId = metaInfoId;

        // get the body
        this.getMetaInfo(metaInfoId);
      });
    } else {
      this.changePage('signin');
    }
    this.setState({isSignedIn});
  }

  changePage = page => {
    let state = {curPage: page};

    // clean up when leaving 'play'
    if(this.state.curPage === 'play') {
      //-- leaving play --//
      state.curItem = null;
      state.nextResIdx = 0;
      state.subtitle = '';
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
        params: {pageToken},
      });
    } else {
      // init
      this.albums = [];

      // request
      response = await this.gapi.client.request({
        path: 'https://photoslibrary.googleapis.com/v1/albums',
        method: 'GET',
      });
    }

    // response
    if(response.status === 200) {
      //-- success --//
      let albums = response.result.albums;

      // append to previous one
      this.albums = this.albums.concat(albums);

      // sort
      this.albums.sort((l, r) => ('' + l.title).localeCompare(r.title));

      // save
      this.setState({albums: this.albums});

      // request next page
      if(response.result.nextPageToken) {
        this.getAlbums(response.result.nextPageToken);
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
        params: {albumId, pageToken},
      });
    } else {
      // init
      this.mediaItems = [];
      
      // request
      response = await this.gapi.client.request({
        path: 'https://photoslibrary.googleapis.com/v1/mediaItems:search',
        method: 'POST',
        params: {albumId},
      });
    }

    // response
    if(response.status === 200) {
      //-- success --//
      const mediaItems = response.result.mediaItems;

      // append to previous one
      this.mediaItems = this.mediaItems.concat(mediaItems);

      // save
      this.setState({mediaItems: this.mediaItems});

      // request next page
      if(response.result.nextPageToken) {
        this.getMediaItems(albumId, response.result.nextPageToken);
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
      const encoding = chardet.detect(buf);
      
      // adjust encoding
      buf = iconv.decode(buf, encoding);
      
      // convert to .vtt
      let vtt;
      if(file.name.endsWith('.smi')) {
        vtt = smi2vtt(buf);
      } else {
        vtt = subsrt.convert(buf, {format: 'vtt'});
      }
      
      // `subsrt` produces timestamp using comma(,). Fix it.
      vtt = vtt.replace(/([0-9]),([0-9])/g, '$1.$2');

      // upload
      const folderId = await this.getFolderId(this.state.curItem.id);
      const subtitleId = await this.getSubtitleId(folderId);
      await this.setSubtitle(subtitleId, vtt);
    }

    reader.readAsArrayBuffer(file);
  }

  
  
  onDropRejected = files => {
    console.error('Rejected:', files);
  }

  playNextRes = async () => {
    // unmount video player
    await this.setState({refreshPlayer: true});

    // remount with next resolution list
    this.setState({nextResIdx: this.state.nextResIdx+1, refreshPlayer: false});
  }

  // get the id of folder that contains some data for 'item' in Drive
  getFolderId = async itemId => {
    const drive = this.gapi.client.drive;
    let response, folderId;

    // check if the folder exists
    response = await drive.files.list({
      // parents: ['appDataFolder'],
      q: 'name="' + itemId + '" and mimeType="application/vnd.google-apps.folder"',
      spaces: 'appDataFolder',
      fields: 'files(id, name, mimeType)',
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      //-- found --//
      folderId = files[0].id;
    } else {
      //-- not found --//
      // create one
      response = await drive.files.create({
        name: itemId,
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['appDataFolder'],
        fields: 'id',
      });
      switch(response.status) {
        case 200:
          const file = response.result;
          folderId = file.id;
          break;
        default:
          console.error('Error creating the folder, ', response);
          break;
      }
    }

    return folderId;
  }

  // get the metaInfo id
  getMetaInfoId = async () => {
    const drive = this.gapi.client.drive;
    let response, metaInfoId;

    // check if the folder exists
    response = await drive.files.list({
      q: 'name="' + METAINFO_FILENAME + '"',
      spaces: 'appDataFolder',
      fields: 'files(id)',
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      //-- found --//
      metaInfoId = files[0].id;
    } else {
      //-- not found --//
      // create one
      response = await drive.files.create({
        name: METAINFO_FILENAME,
        parents: ['appDataFolder'],
      });
      switch(response.status) {
        case 200:
          const file = response.result;
          metaInfoId = file.id;

          // init
          await this.setMetaInfo(metaInfoId, {});
          break;
        default:
          console.error('Error creating the folder, ', response);
          break;
      }
    }

    return metaInfoId;
  }

  // get the meta info
  getMetaInfo = async metaInfoId => {
    const drive = this.gapi.client.drive;
    let response, metaInfo = {};
    
    // download
    response = await drive.files.get({
      fileId: metaInfoId,
      alt: 'media'
    });
    switch(response.status) {
      case 200:
        metaInfo = JSON.parse(response.body);
        this.setState({metaInfo});
        break;
      default:
        console.error('Error creating the folder, ', response);
        break;
    }
  }

  // set meta info(overwrite)
  // metaInfo: {}
  setMetaInfo = async (metaInfoId, metaInfo) => {
    // write
    const response = await this.gapi.client.request({
      path: '/upload/drive/v3/files/' + metaInfoId,
      method: 'PATCH',
      params: {
        uploadType: 'media'
      },
      body: JSON.stringify(metaInfo)
    });
    switch(response.status) {
      case 200:
        break;
      default:
        console.error('Error getting meta info', response);
        throw new Error('Error getting meta info');
    }
  }

  getSubtitleId = async folderId => {
    const drive = this.gapi.client.drive;
    let response, subtitleId;

    // check if the folder exists
    response = await drive.files.list({
      parents: [folderId],
      q: 'name="' + SUBTITLE_FILENAME + '" and "' + folderId + '" in parents',
      spaces: 'appDataFolder',
      fields: 'files(id, webContentLink, webViewLink)',
    });
    const files = response.result.files;
    if (files && files.length > 0) {
      //-- found --//
      subtitleId = files[0].id;
    } else {
      //-- not found --//
      // create one
      response = await drive.files.create({
        name: SUBTITLE_FILENAME,
        // mimeType: 'application/vnd.google-apps.folder',
        parents: [folderId],
        // fields: 'id',
      });
      switch(response.status) {
        case 200:
          const file = response.result;
          subtitleId = file.id;
          break;
        default:
          console.error('Error creating the folder, ', response);
          break;
      }
    }

    return subtitleId;
  }

  setSubtitle = async (subtitleId, subtitle) => {
    const response = await this.gapi.client.request({
      path: '/upload/drive/v3/files/' + subtitleId,
      method: 'PATCH',
      params: {
        uploadType: 'media'
      },
      body: subtitle
    });
    switch(response.status) {
      case 200:
        // update subtitle on the fly
        if(this.state.curPage === 'play') {
          this.videoPlayer.updateSubtitle(subtitle);
        }
        break;
      default:
      console.error('Error setting subtitle', response);
      throw new Error('Error setting subtitle');
    }
  }

  // just make it empty
  delSubtitle = subtitleId => this.setSubtitle(subtitleId, '')

  getSubtitle = async subtitleId => {
    const drive = this.gapi.client.drive;
    let response, subtitle = '';
    
    // download
    response = await drive.files.get({
      fileId: subtitleId,
      alt: 'media'
    });
    switch(response.status) {
      case 200:
        subtitle = response.body;
        break;
      default:
        console.error('Error creating the folder, ', response);
        break;
    }

    return subtitle;
  }

  setAlias = async (itemId, alias) => {
    // cancel previous timer
    if(this.aliasTimer)   clearTimeout(this.aliasTimer);

    // set new one
    this.aliasTimer = setTimeout(() => {
      // local update
      let metaInfo = this.state.metaInfo;
      if(metaInfo[itemId]) {
        metaInfo[itemId].alias = alias;   // add
      } else {
        metaInfo[itemId] = {alias};       // new
      }
      this.setState({metaInfo});

      // remote update
      this.setMetaInfo(this.metaInfoId, metaInfo);

      // reinit
      this.aliasTimer = null;
    }, UPDATE_ALIAS_DELAY*1000);
    
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
      const metaInfo = this.state.metaInfo;
      for(let item of videoItems) {
        if(item.mimeType.startsWith('video')) {
          if(item.id in metaInfo && metaInfo[item.id].alias) {
            item.alias = metaInfo[item.id].alias;
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
          console.error('no resolution available');
          return;
        }

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
                                {this.state.subtitle ? '자막 있음' : '자막 끌어놓기'}
                              </Typography>
                            </Grid>
                          </Grid>
                        </div>
                      )
                    }}
                  </Dropzone>
                </Grid>
                {this.state.subtitle &&
                  <Grid item xs={4}>
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => this.handleDelSubtitleClick()}
                    >
                      <DeleteIcon className={classes.rightIcon} />
                      자막 삭제
                    </Button>
                  </Grid>
                }
              </Grid>
            </div>
          </div>
        );
      } else {
        content = <div>불러오는 중</div>;
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