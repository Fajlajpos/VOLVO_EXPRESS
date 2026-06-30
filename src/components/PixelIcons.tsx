import React from 'react';

interface PixelSpriteProps {
  grid: string[];
  colors: Record<string, string>;
  width: number;
  height: number;
  size?: number;
  style?: React.CSSProperties;
}

const PixelSprite: React.FC<PixelSpriteProps> = ({ grid, colors, width, height, size = 20, style }) => {
  return (
    <svg 
      width={size} 
      height={Math.round((size * height) / width)} 
      viewBox={`0 0 ${width} ${height}`} 
      style={{ display: 'inline-block', verticalAlign: 'middle', shapeRendering: 'crispEdges', ...style }}
    >
      {grid.map((row, y) => 
        row.split('').map((char, x) => {
          if (char === ' ' || char === '.') return null;
          const color = colors[char] || '#ffffff';
          return (
            <rect 
              key={`${x}-${y}`} 
              x={x} 
              y={y} 
              width={1} 
              height={1} 
              fill={color} 
            />
          );
        })
      )}
    </svg>
  );
};

// Colors mapping table
const JDM_COLORS = {
  'W': '#ffffff',
  'K': '#000000',
  'P': '#ff79c6', // Pink
  'C': '#8be9fd', // Cyan
  'Y': '#f1fa8c', // Yellow
  'R': '#ff5555', // Red
  'G': '#6272a4', // Gray
  'B': '#50fa7b', // Green/Active LED
  'D': '#282a36', // Dark LED
};

interface IconProps {
  size?: number;
  style?: React.CSSProperties;
}

// 24x10 JDM Drift Car
export const PixelCar: React.FC<IconProps> = ({ size = 28, style }) => {
  const grid = [
    "        CCCCCC          ",
    "      CCCCCCCCC         ",
    " P   CCCCCCCCCCC        ",
    "PPPPPPPPPPPPPPPPPPPPP   ",
    "WWWWWWWWWWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWWWWWWWWWW",
    "  KKKKK      KKKKK      ",
    " KKKKKKK    KKKKKKK     ",
    "  KKKKK      KKKKK      "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={24} height={9} size={size} style={style} />;
};

// 16x16 Fuel Pump
export const PixelFuel: React.FC<IconProps> = ({ size = 20, style }) => {
  const grid = [
    "     RRRRRR     ",
    "    RWWWWWWR    ",
    "    RWWCCWWR YY ",
    "    RWWCCWWR  Y ",
    "    RWWWWWWR  Y ",
    "    RRRRRRRR  Y ",
    "    RWWWWWWR  Y ",
    "    RWWWWWWR  Y ",
    "    RWWWWWWR Y  ",
    "    RWWWWWWR Y  ",
    "    RWWWWWWR Y  ",
    "    RWWWWWWR Y  ",
    "    RWWWWWWR Y  ",
    "    RRRRRRRR Y  ",
    "   RRRRRRRRRRY  ",
    "  RRRRRRRRRRRY  "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Key
export const PixelKey: React.FC<IconProps> = ({ size = 20, style }) => {
  const grid = [
    "     YYYYY      ",
    "    Y     Y     ",
    "   Y  YYY  Y    ",
    "   Y  YYY  Y    ",
    "    Y     Y     ",
    "     YYYYY      ",
    "      YYY       ",
    "      YYY       ",
    "      YYY       ",
    "      YYYY      ",
    "      YYY       ",
    "      YYYY      ",
    "      YYY       ",
    "      YYYY      ",
    "       YY       ",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Checkpoint Clock
export const PixelClock: React.FC<IconProps> = ({ size = 20, style }) => {
  const grid = [
    "      CCCC      ",
    "     CCCCCC     ",
    "    CCKKKKCC    ",
    "   CKKWWWWKKC   ",
    "  CKWWWWWWWWKC  ",
    " CKWWWWPWWWWKC  ",
    "CKWWWWWPWWWWWWK ",
    "CKWWWWWPWWWWWWK ",
    "CKWWWWWWWWWWWWK ",
    "CKWWWWWWWWWWWWK ",
    " CKWWWWWWWWWWK  ",
    "  CKWWWWWWWWK   ",
    "   CKWWWWWWK    ",
    "    CKKKKKK     ",
    "                ",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Wrench
export const PixelWrench: React.FC<IconProps> = ({ size = 20, style }) => {
  const grid = [
    "     GGGGG      ",
    "    GG   GG     ",
    "    G     G     ",
    "    GG   GG     ",
    "     GGGGG      ",
    "      GGG       ",
    "      GGG       ",
    "       G        ",
    "       G        ",
    "       G        ",
    "       G        ",
    "       G        ",
    "       G        ",
    "      GGG       ",
    "     GGGGG      ",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Checkered Flag
export const PixelFlag: React.FC<IconProps> = ({ size = 20, style }) => {
  const grid = [
    "  GGGG          ",
    "  G KKKWWWKKK   ",
    "  G KKWKKWKKW   ",
    "  G KKWKKWKKW   ",
    "  G WWWKKKWWW   ",
    "  G KKKWWWKKK   ",
    "  G KKWKKWKKW   ",
    "  G KKWKKWKKW   ",
    "  G WWWKKKWWW   ",
    "  G             ",
    "  G             ",
    "  G             ",
    "  G             ",
    "  G             ",
    "  G             ",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Floppy Disk (Save)
export const PixelSave: React.FC<IconProps> = ({ size = 20, style }) => {
  const grid = [
    "  CCCCCCCCCCCC  ",
    " CCCCCCCCWWCC  C",
    " CCWWWWWWWWCC CC",
    " CCWKKKKKKWCC CC",
    " CCWKKKKKKWCC CC",
    " CCWKKKKKKWCC CC",
    " CCCCCCCCCCCC CC",
    " CCCCCCCCCCCC CC",
    " CCWWWWWWWWCC CC",
    " CCWYYYYYYWCC CC",
    " CCWYYYYYYWCC CC",
    " CCWYYYYYYWCC CC",
    " CCWYYYYYYWCC CC",
    " CCCCCCCCCCCC CC",
    "  CCCCCCCCCCCC  ",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Trophy
export const PixelTrophy: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => {
  const grid = [
    " YYYYYYYYYYYYYY ",
    "Y YYYYYYYYYYYY Y",
    "YY YYYYYYYYYY YY",
    " YYYYYYYYYYYYYY ",
    "  YYYYYYYYYYYY  ",
    "   YYYYYYYYYY   ",
    "    YYYYYYYY    ",
    "     YYYYYY     ",
    "      YYYY      ",
    "      YYYY      ",
    "     YYYYYY     ",
    "    YYYYYYYY    ",
    "  YYYYYYYYYYYY  ",
    " YYYYYYYYYYYYYY ",
    "                ",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Alert
export const PixelAlert: React.FC<IconProps> = ({ size = 20, style }) => {
  const grid = [
    "       RR       ",
    "      RRRR      ",
    "      RKKR      ",
    "     RRKKRR     ",
    "     RKKKKR     ",
    "    RRKKKKRR    ",
    "    RKKKKKKR    ",
    "   RRKKKKKKRR   ",
    "   RKKKKKKKKR   ",
    "  RRKKKKKKKKRR  ",
    "  RKKKKKKKKKKR  ",
    " RRKKKKKKKKKKRR ",
    " RKKKKKKKKKKKKR ",
    "RRRRRRRRRRRRRRRR",
    "                ",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Check (Glowing Green Checkmark)
export const PixelCheck: React.FC<IconProps> = ({ size = 20, style }) => {
  const grid = [
    "                ",
    "             BB ",
    "            BBB ",
    "           BBB  ",
    "          BBB   ",
    "         BBB    ",
    "  BB    BBB     ",
    " BBB   BBB      ",
    "  BBB BBB       ",
    "   BBBBB        ",
    "    BBB         ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Info Node
export const PixelInfo: React.FC<IconProps> = ({ size = 20, style }) => {
  const grid = [
    "      CCCC      ",
    "    CCCCCCCC    ",
    "   CCCC  CCCC   ",
    "  CCCC    CCCC  ",
    "  CCCC KK CCCC  ",
    "  CCCC KK CCCC  ",
    "   CCCC  CCCC   ",
    "  CCCC KK CCCC  ",
    "  CCCC KK CCCC  ",
    "  CCCC KK CCCC  ",
    "  CCCC KK CCCC  ",
    "   CCCC  CCCC   ",
    "  CCCC    CCCC  ",
    "    CCCCCCCC    ",
    "      CCCC      ",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Delete Cross
export const PixelCross: React.FC<IconProps> = ({ size = 16, style }) => {
  const grid = [
    "RR            RR",
    "RRR          RRR",
    " RRR        RRR ",
    "  RRR      RRR  ",
    "   RRR    RRR   ",
    "    RRR  RRR    ",
    "     RRRRRR     ",
    "      RRRR      ",
    "     RRRRRR     ",
    "    RRR  RRR    ",
    "   RRR    RRR   ",
    "  RRR      RRR  ",
    " RRR        RRR ",
    "RRR          RRR",
    "RR            RR",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};

// 16x16 Compass Icon (Directional arrow)
export const PixelCompass: React.FC<IconProps> = ({ size = 20, style }) => {
  const grid = [
    "      CCCC      ",
    "    CCCCCCCC    ",
    "   CCCC  CCCC   ",
    "  CCCC CC CCCC  ",
    "  CCCC RR CCCC  ",
    "  CC C R R C CC ",
    "  C C  R  C C C ",
    "  C C  R  C C C ",
    "  CC C G G C CC ",
    "  CCCC GG CCCC  ",
    "  CCCC CC CCCC  ",
    "   CCCC  CCCC   ",
    "    CCCCCCCC    ",
    "      CCCC      ",
    "                ",
    "                "
  ];
  return <PixelSprite grid={grid} colors={JDM_COLORS} width={16} height={16} size={size} style={style} />;
};
