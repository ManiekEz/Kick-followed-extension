import apiCall from "./shared.js";
const GET_LIVE_STREAMS = 'https://kick.com/api/v1/user/livestreams';
const GET_FOLLOWED = 'https://kick.com/api/v2/channels/followed-page';

class KickApp {
    sessionToken;
    channels = [];

    constructor() {
        this.updateSessionToken().then(() => {
            this.init();
        }).catch((error) => {
            this.clearData();
            this.updateBadge("0"); 
            return;
        });
    }
    clearData() {
        this.updateStorage("sessionToken", null);
        this.updateStorage("followed", null);
        this.updateStorage("live", null);
    } 
    async init() {
        this.updateFollowed();
        this.updateLive();
        await chrome.alarms.create("updateData", { periodInMinutes: 1 });
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.updateSessionToken().then(() => {
                this.updateFollowed();
                this.updateLive();
            }).catch(() => {
                chrome.alarms.clear("updateData");
                this.clearData();
                return;
            });
        });
    }

    updateStorage(name, value) {  
        chrome.storage.local.set({ [name]: value });
    }

    updateBadge(value) {
        opr.sidebarAction.setBadgeText({ text: `${value}` });
    }

    async getFollowed(cursor) {
        let response;
        if (cursor) {
            response = await apiCall(`${GET_FOLLOWED}?cursor=` + cursor, this.sessionToken);
            this.channels = this.channels.concat(response.channels);
        } else {
            response = await apiCall(GET_FOLLOWED, this.sessionToken);
            this.channels = response.channels;
        }
        if (response.nextCursor) {
            return this.getFollowed(response.nextCursor);
        }
        return this.channels;
    }

    async getCategoryImg(slug) {
        let response = await apiCall(`https://kick.com/api/v1/subcategories/${slug}`);
        return response;
    }
    //Update methods just override data in storage. Not yet checked if it has big impact on performance.
    async updateFollowed() {
        try {
            const response = await this.getFollowed();
            if (!Array.isArray(response)) {
                this.updateStorage("followed",  null);
                return;
            }
            const followed = response.map(channel => ({
                channel_slug: channel.channel_slug,
                is_live: channel.is_live,
                profile_picture: channel.profile_picture
            }));
            this.updateStorage("followed", followed);
        } catch (error) {
            this.updateStorage("followed",  error);
            return;
        }
    }

    async updateLive() {
        try {
            const response = await apiCall(GET_LIVE_STREAMS, this.sessionToken);
            const live = await Promise.all(response.map(async (channel) => ({
                channel_slug: channel.channel.slug,
                category_img: (await this.getCategoryImg(channel.categories[0].slug)).banner.src,
                title: channel.session_title
            })));
            this.updateBadge(live.length);
            this.updateStorage("live", live);
        } catch (error) {
            this.updateStorage("live", error);
            return;
        }
    }

    async updateSessionToken() {
        return new Promise((resolve, reject) => {
            chrome.cookies.get({ url: 'https://kick.com', name: 'session_token' }, (cookie) => {
                if (cookie) {
                    this.sessionToken = decodeURIComponent(cookie.value);
                    this.updateStorage("sessionToken", this.sessionToken);
                    resolve();
                } else {
                    reject(new Error("Session token not found"));
                }
            });
        });
    }
}

const kick = new KickApp();