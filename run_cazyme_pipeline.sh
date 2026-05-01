#!/bin/bash

DB="/mnt/e/BifidoBase/annotation_pipeline/db/dbCAN-HMMdb-V14.txt"
BASE="/mnt/e/BifidoBase/annotation_pipeline/prokka_output"
SCRIPT_DIR="/mnt/e/BifidoBase/annotation_pipeline/db"

for dir in $BASE/*; do
    acc=$(basename $dir)
    faa="$dir/$acc.faa"

    if [ -f "$faa" ]; then
        echo "Processing $acc..."

        # run hmmscan
        hmmscan --domtblout $dir/cazyme.out \
        --cpu 4 \
        --noali \
        $DB \
        $faa

        # parse
        python $SCRIPT_DIR/parse_dbcan.py $dir/cazyme.out $acc

        # summarize
        python $SCRIPT_DIR/summarize_dbcan.py $acc

        # add accession + upload
        python $SCRIPT_DIR/add_dbcan_accession.py $acc
        python $SCRIPT_DIR/upload_dbcan.py $acc

    fi
done
