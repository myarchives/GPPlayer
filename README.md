# GPPlayer
A simple Google Photos Player

## Installation

#### Requirements
- Web server for client like [Apache], [Nginx]

#### Deployment procedure
1. Go to [GCP console][GCP console].
1. Create a new project.
1. Enable Google Drive and Photos Libary APIs.
1. In the Credentials pane, create an OAuth client ID and a API key.
    > Limit your keys to your domain as these will be revealed in public.
1. Put your OAuth client ID and API key into *package.json*.
1. Run the following.
    ```bash
    $ cd /path/to/client/
    $ npm install
    $ npm run build
    ```
1. Place *build/* to your web server document root.



[GCP console]: <https://console.cloud.google.com>
[apache]: <https://www.apache.org/>
[nginx]: <https://www.nginx.com/>