import React from 'react';

const MapView = ({ children }: any) => <>{children}</>;
const Camera = () => null;

const MapboxGL = {
    MapView,
    Camera,
    setAccessToken: () => {},
    setWellKnownTileServer: () => {},
};

export default MapboxGL;
