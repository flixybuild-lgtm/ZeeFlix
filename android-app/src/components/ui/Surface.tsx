import React from 'react';
import {View, ViewProps} from 'react-native';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';

type SurfaceLevel = 'lowest' | 'low' | 'default' | 'high' | 'highest';

interface SurfaceProps extends ViewProps {
  level?: SurfaceLevel;
  outlined?: boolean;
}

const Surface = ({
  level = 'default',
  outlined = false,
  style,
  ...props
}: SurfaceProps) => {
  const colors = useM3Colors();
  const backgrounds: Record<SurfaceLevel, string> = {
    lowest: 'rgba(255,255,255,0.035)',
    low: 'rgba(255,255,255,0.055)',
    default: 'rgba(255,255,255,0.075)',
    high: 'rgba(255,255,255,0.095)',
    highest: 'rgba(255,255,255,0.12)',
  };

  // Liquid-glass treatment: a translucent fill and fine highlight edge keep
  // cards light over artwork without adding a costly native blur to every row.
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: backgrounds[level],
          borderRadius: isTV ? 24 : 28,
          borderWidth: 1,
          borderColor: outlined ? colors.primary : 'rgba(255,255,255,0.13)',
          overflow: 'hidden',
        },
        style,
      ]}
    />
  );
};

export default Surface;
