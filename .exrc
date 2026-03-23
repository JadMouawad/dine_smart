if &cp | set nocp | endif
let s:cpo_save=&cpo
set cpo&vim
inoremap <C-U> u
nmap Q gq
xmap Q gq
omap Q gq
xmap gx <Plug>(open-word-under-cursor)
nmap gx <Plug>(open-word-under-cursor)
xnoremap <Plug>(open-word-under-cursor) <ScriptCmd>vim9.Open(getregion(getpos('v'), getpos('.'), { type: mode() })->join())
nnoremap <Plug>(open-word-under-cursor) <ScriptCmd>vim9.Open(GetWordUnderCursor())
inoremap  u
let &cpo=s:cpo_save
unlet s:cpo_save
set autoindent
set clipboard=unnamed
set display=truncate
set fileencodings=ucs-bom,utf-8,default,latin1
set helplang=en
set incsearch
set langnoremap
set nolangremap
set laststatus=2
set nrformats=bin,hex
set runtimepath=~/.vim,/usr/share/vim/vimfiles,/usr/share/vim/vim91,/usr/share/vim/vim91/pack/dist/opt/netrw,/usr/share/vim/vimfiles/after,~/.vim/after
set scrolloff=5
set showmatch
set statusline=%f%h%m%r\ [%{&ff}]\ (%{strftime(\"%H:%M\ %d/%m/%Y\",getftime(expand(\"%:p\")))})%=%l,%c%V\ %P
set ttimeout
set ttimeoutlen=100
set visualbell
set wildmode=list:longest,longest:full
" vim: set ft=vim :
