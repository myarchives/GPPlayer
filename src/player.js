import React from 'react';
import './App.css';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-hotkeys/videojs.hotkeys';

// The following registers the plugin with `videojs`
require('silvermine-videojs-quality-selector')(videojs);

class VideoPlayer extends React.Component {
  componentDidMount = () => {
    this.props.onRef(this);
    const app = this.props.app;
    
    this.player = videojs(this.videoNode, {
      autoplay: true,
      controls: true,
      sources: this.props.sources,
      aspectRatio: '16:9',
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      controlBar: {
        // refer to 'Default Component Tree' section
        // at https://docs.videojs.com/tutorial-components.html
        children: [
          'playToggle',
          'volumePanel',
          // 'currentTimeDisplay',
          // 'durationDisplay',
          'progressControl',
          'subtitlesButton',
          // 'CaptionsButton',
          'playbackRateMenuButton',
          'qualitySelector',
          'fullscreenToggle',
        ],
      },
    });

    this.player.on('ready', () => {
      // hotkey
      this.player.hotkeys({
        volumeStep: 0.1,
        seekStep: 5,
        enableModifiersForNumbers: false,
      });

      // set current time
      if(app.state.currentTime) {
        this.player.currentTime(app.state.currentTime);
      }
      
      // vtt
      new Promise(async (resolve, reject) => {
        const vttId = app.state.vtts[app.state.curItem.id];
        if(vttId) {
          const subtitle = await app.getFile(vttId);
          if(subtitle) {
            this.updateSubtitle(subtitle);
          } else {
            //-- empty subtitle --//
            app.handleDelSubtitle();
          }
        }
        resolve();
      });
    });
    
    this.player.on('error', err => {
      console.error(err);
      const currentTime = this.player.currentTime();
      if(currentTime > 2) {
        //-- error during playing --//
        // try with the same resolution
        app.refreshPlayer(currentTime);
      } else {
        //-- current resolution is not available --//
        // try with next resolution
        app.playNextRes();
      }
    });
  }

  updateSubtitle = subtitle => {
    // remove previous one
    this.removeSubtitle();

    // use data url
    this.player.addRemoteTextTrack({
      src: 'data:text/plain,' + subtitle,
      default: true,
      srclang: 'ko',
    }, false);

    // show the new one
    let textTracks = this.player.textTracks();
    textTracks[0].mode = 'showing';

    // update for app
    this.props.app.setState({subtitle});
  }

  removeSubtitle = () => {
    let textTracks = this.player.textTracks();
    if(textTracks.length > 0) {
      this.player.removeRemoteTextTrack(textTracks[0]);
    }
  }

  // destroy player on unmount
  componentWillUnmount() { if (this.player) this.player.dispose() }

  render() {
    // wrap the player in a div with a `data-vjs-player` attribute
    // so videojs won't create additional wrapper in the DOM
    // see https://github.com/videojs/video.js/pull/3856
    return (
      <div>
        <div data-vjs-player>
          <video
            ref={ node => this.videoNode = node }
            className="video-js"
            style={{fontSize: '13px'}}
          />
        </div>
      </div>
    )
  }
}

export default VideoPlayer;