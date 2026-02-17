const appJson = require('./app.json');

module.exports = {
    ...appJson,
    expo: {
        ...appJson.expo,
        slug: "junggae-note",
        extra: {
            ...appJson.expo.extra,
            eas: {
                projectId: "e2476aba-1d48-4d0a-ac64-7b99d6665422"
            }
        }
    }
};
