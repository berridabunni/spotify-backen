const fs = require("fs");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const querystring = require("querystring");
require("dotenv").config();

const app = express();
app.use(cors());

const PORT = 8888;

function saveToken(token) {
  fs.writeFileSync("token.json", JSON.stringify({ refresh_token: token }));
}

function loadToken() {
  if (!fs.existsSync("token.json")) return null;
  const data = JSON.parse(fs.readFileSync("token.json"));
  return data.refresh_token;
}

app.get("/login", (req, res) => {
  const scope = "user-read-recently-played";

  const authUrl =
    "https://accounts.spotify.com/authorize?" +
    querystring.stringify({
      response_type: "code",
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope,
      redirect_uri: process.env.REDIRECT_URI,
    });

  res.redirect(authUrl);
});

// CALLBACK
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    querystring.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.REDIRECT_URI,
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.SPOTIFY_CLIENT_ID +
              ":" +
              process.env.SPOTIFY_CLIENT_SECRET
          ).toString("base64"),
      },
    }
  );

  saveToken(response.data.refresh_token);

  res.send("Logged in! You can close this tab.");
});

// GET ACCESS TOKEN
async function getAccessToken() {
  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    querystring.stringify({
      grant_type: "refresh_token",
      refresh_token: loadToken(),
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            process.env.SPOTIFY_CLIENT_ID +
              ":" +
              process.env.SPOTIFY_CLIENT_SECRET
          ).toString("base64"),
      },
    }
  );

  return response.data.access_token;
}
// RECENT SONGS
app.get("/recent", async (req, res) => {
  try {
    const token = await getAccessToken();

    const data = await axios.get(
      "https://api.spotify.com/v1/me/player/recently-played?limit=10",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    res.json(
      data.data.items.map((i) => ({
        song: i.track.name,
        artist: i.track.artists.map((a) => a.name).join(", "),
        played_at: i.played_at,
      }))
    );
  } catch (err) {
    res.status(500).send("Error fetching songs");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});