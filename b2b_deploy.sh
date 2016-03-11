#!/bin/bash
# Запускать только в Vagrant
# Копирование проекта в директорию, из которой будут выполняться тесты
# Принудительно перезатирает все изменения в директории-дупликате!

if [[ $UID != 0 ]]; then
    echo "Please run this script with sudo:"
    echo "sudo $0 $*"
    exit 1
fi

mkdir -p /var/reps/
cp -fR /raid/vhosts/b2bcenter /var/reps/
cp -fR /raid/vhosts/files /var/reps/
chmod 777 /var/reps/files