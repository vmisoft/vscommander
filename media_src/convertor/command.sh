ffmpeg -i input.mp4 -vf "fps=10,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" intermediate.gif
#ffmpeg -i input.mp4 -vf "fps=10,split[s0][s1];[s0]palettegen=max_colors=16[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" intermediate.gif
gifsicle -O3 --lossy=80 intermediate.gif -o final.gif