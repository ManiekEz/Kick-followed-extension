import apiCall from "./shared.js";
class kickApp {
    sessionToken;
    streams;
    stream;
    followed;
    liveStreams;

    constructor() {
        chrome.cookies.get({url: 'https://kick.com', name: 'session_token'}).then(cookie => {  //checking if user is logged to kick by checking cookies
            if (!cookie) {
                opr.sidebarAction.setBadgeText({text: "0"});
                chrome.alarms.create("updateData",{when: Date.now()}); //clearing old data in case of switching acc;
                document.body.innerHTML = `
                <main id='logIn'>
                    <div>
                        <h2 class="logInTxt">Please Log In</h2>
                        <p class="logInTxt">You need to be logged in to view your followed streamers.</p>
                        <p>If there is nothing after login refresh.</p>
                        <a id='goKick' target='_blank' href='https://kick.com'><span class='kick_text'>GO TO KICK</span> </a>
                    </div>
                </main>`;
                return;
            }
            this.localSessionToken = decodeURIComponent(cookie.value);
            if (document.readyState === "complete" || document.readyState === "interactive") {
                this.init();
            } else {
                document.addEventListener("DOMContentLoaded", () => {
                    this.init();
                });
            }
        });
    }

    async getFollowed() {
        return new Promise(async (resolve, reject) => {
            let followed = await chrome.storage.local.get("followed");
            if (followed.error) {
                this.somethingWentWrong();
                reject();
            } else if (!followed.followed && followed.length <= 0 || followed.followed == null) {
                this.noFollowed();
                reject();
            }
            this.followed = followed.followed;
            resolve();
        });
    }

    async getLive() {
        let live = await chrome.storage.local.get("live");
        if (live.error) {
            this.somethingWentWrong(); // could just render followed.
            return;
        }
        this.liveStreams = live.live;
    }

    somethingWentWrong() {
        document.body.innerHTML = `
        <main id='logIn'>
            <div>
                <h2>Something went wrong</h2>
                <p> Please try again later or try reload whole extension in browsers extensions tab</p>
            </div>
        </main>`;
    }

    noFollowed() {
        document.getElementById("streams_list").innerHTML = `<h2 class="logInTxt">You are currently not following any streamer</h2>`;
    }

    updateStreamersList() { //Rerendering whole list to get all the latest data. Not the most efficient way.
        document.getElementById("streams_list").innerHTML = '';
        this.renderStreams();
    }

    async init() {
        this.streams = document.querySelector("#streams_list");
        this.stream = document.querySelector("template");
        this.sessionToken = (await chrome.storage.local.get("sessionToken")).sessionToken;
        if (this.localSessionToken !== this.sessionToken) { //checking if user switched account
            chrome.runtime.reload(); // reloading extension to activate service worker. Easy way of updating data after account switch.
        } else {
            this.setUserData();
            Promise.all([this.getFollowed(), this.getLive()]).then(() => {
                this.renderStreams();
            })
        }
        chrome.alarms.onAlarm.addListener(() => { this.updateStreamersList(); });
        document.getElementById("search").addEventListener("input", (input) => { this.filterStreams(input.target.value) });
    }

    renderStreams() {
        for (let channel of this.followed) {
            let streamClone = this.stream.content.querySelector("#stream").cloneNode(true); //cloning stream element from template in html file.
            streamClone.title = channel.channel_slug;
            streamClone.href = "https://kick.com/" + channel.channel_slug;
            streamClone.name = channel.channel_slug;

            let channelPic = streamClone.querySelector("#channelPic");
            if (channel.profile_picture) {
                channelPic.src = channel.profile_picture;
            }
            if (channel.is_live) {
                channelPic.style.filter = "grayscale(0)";
            }
            this.streams.appendChild(streamClone);
        }
        this.renderCategories();
    }

    async renderCategories() {
        if (this.liveStreams.length <= 0) {
            return;
        }
        for (let stream of await this.liveStreams) {
            let elem = document.getElementsByName(stream.channel_slug)[0];
            elem.querySelector("#category").style.display = "inline"; //undefined query selector
            elem.querySelector("#category").src = await stream.category_img;
        }
    }

    async setUserData() {
        let response = await apiCall("https://kick.com/api/v1/user", this.sessionToken);
        document.getElementById("nick").innerHTML = response.username;
        if (response.profilepic) {
            document.getElementById("profile_picture").src = response.profilepic;
        }
        apiCall(`https://kick.com/api/v2/channels/${response.streamer_channel.slug}/info`).then((response1) => {
            document.getElementById("followers").innerHTML = "Followers: " + response1.followers_count;
        });
    }

    filterStreams(input) {
        if (input == " " || input == null) { return; }
        for (let stream of this.streams.getElementsByTagName("a")) {
            let name = stream.name.toLowerCase();
            if (!(name.indexOf(input.toLowerCase()) >= 0)) {
                stream.style.display = "none";
            } else {
                stream.style.display = "inline";
            }
        }
    }
}

const kick = new kickApp();