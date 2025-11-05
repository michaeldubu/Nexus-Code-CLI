#!/usr/bin/env python3
"""
SAAAM Mass File Replacer - Production Grade
Handles massive directories with parallel processing and real-time progress
"""
import argparse
import sys
from pathlib import Path
from multiprocessing import Pool, cpu_count, Manager
from typing import Tuple, List, Dict
import time
from functools import partial

# Common directories to skip (saves time on node_modules, .git, etc)
SKIP_DIRS = {
    '.git', '.svn', '.hg', 'node_modules', '__pycache__', 
    '.venv', 'venv', '.pytest_cache', '.mypy_cache',
    'dist', 'build', '.eggs', '*.egg-info'
}

class ProgressTracker:
    """Thread-safe progress tracking"""
    def __init__(self, total: int):
        self.total = total
        self.processed = 0
        self.modified = 0
        self.errors = 0
        self.replacements = 0
        self.start_time = time.time()
        
    def update(self, modified: bool, replacement_count: int, error: bool):
        self.processed += 1
        if modified:
            self.modified += 1
            self.replacements += replacement_count
        if error:
            self.errors += 1
            
    def print_progress(self):
        elapsed = time.time() - self.start_time
        rate = self.processed / elapsed if elapsed > 0 else 0
        pct = (self.processed / self.total * 100) if self.total > 0 else 0
        
        eta = (self.total - self.processed) / rate if rate > 0 else 0
        eta_str = f"{int(eta)}s" if eta < 60 else f"{int(eta/60)}m {int(eta%60)}s"
        
        print(f"\r[{pct:6.2f}%] {self.processed:,}/{self.total:,} files | "
              f"Modified: {self.modified:,} | Replacements: {self.replacements:,} | "
              f"Errors: {self.errors} | Rate: {rate:.1f} files/s | ETA: {eta_str}",
              end='', flush=True)

def is_binary(file_path: Path) -> bool:
    """Fast binary file detection"""
    try:
        with open(file_path, 'rb') as f:
            chunk = f.read(8192)
            # Check for null bytes (common in binary files)
            if b'\x00' in chunk:
                return True
            # Check for high percentage of non-text bytes
            text_chars = bytearray({7,8,9,10,12,13,27} | set(range(0x20, 0x100)) - {0x7f})
            non_text = sum(1 for byte in chunk if byte not in text_chars)
            return non_text / len(chunk) > 0.3 if chunk else False
    except:
        return True

def replace_in_file(
    path: Path, 
    replacements: List[Tuple[str, str]], 
    dry_run: bool,
    case_sensitive: bool
) -> Tuple[bool, int, str]:
    """
    Process a single file with multiple replacements
    Returns: (was_modified, replacement_count, error_message)
    """
    try:
        # Skip binary files
        if is_binary(path):
            return (False, 0, "")
        
        # Read file
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
        except Exception as e:
            return (False, 0, f"Read error: {e}")
        
        # Apply all replacements
        new_text = text
        total_count = 0
        
        for old, new in replacements:
            if case_sensitive:
                count = new_text.count(old)
                if count > 0:
                    new_text = new_text.replace(old, new)
                    total_count += count
            else:
                # Case-insensitive replacement
                import re
                pattern = re.compile(re.escape(old), re.IGNORECASE)
                matches = len(pattern.findall(new_text))
                if matches > 0:
                    new_text = pattern.sub(new, new_text)
                    total_count += matches
        
        # Write if changed
        if total_count > 0 and new_text != text:
            if not dry_run:
                try:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_text)
                except Exception as e:
                    return (False, 0, f"Write error: {e}")
            return (True, total_count, "")
        
        return (False, 0, "")
        
    except Exception as e:
        return (False, 0, f"Unexpected error: {e}")

def process_file_wrapper(
    args: Tuple[Path, List[Tuple[str, str]], bool, bool, 'Queue']
) -> Tuple[bool, int, str, Path]:
    """Wrapper for multiprocessing with progress queue"""
    path, replacements, dry_run, case_sensitive, progress_queue = args
    modified, count, error = replace_in_file(path, replacements, dry_run, case_sensitive)
    progress_queue.put((modified, count, bool(error)))
    return (modified, count, error, path)

def collect_files(root: Path, patterns: List[str], skip_dirs: set) -> List[Path]:
    """Collect all files matching patterns, excluding skip_dirs"""
    files = []
    
    if 'all' in patterns or '*' in patterns:
        # Get everything
        for item in root.rglob('*'):
            if item.is_file() and not any(skip in item.parts for skip in skip_dirs):
                files.append(item)
    else:
        # Get specific extensions
        for pattern in patterns:
            for item in root.rglob(f'*.{pattern}'):
                if item.is_file() and not any(skip in item.parts for skip in skip_dirs):
                    files.append(item)
    
    return files

def main():
    parser = argparse.ArgumentParser(
        description="SAAAM Mass Replacer - Production Grade Multi-threaded File Processor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --find "saaam-dev" --replace "saaam-dev" --ext all
  %(prog)s -f "old" -r "new" -f "foo" -r "bar" --ext py js ts
  %(prog)s --find "test" --replace "prod" --root ./src --workers 16 --dry-run
        """
    )
    
    parser.add_argument('-f', '--find', action='append', required=True,
                       help='Text to find (can specify multiple times)')
    parser.add_argument('-r', '--replace', action='append', required=True,
                       help='Replacement text (must match --find count)')
    parser.add_argument('--root', default='.', help='Root directory (default: current)')
    parser.add_argument('--ext', nargs='+', default=['all'],
                       help='File extensions to process (default: all)')
    parser.add_argument('--workers', type=int, default=cpu_count(),
                       help=f'Number of parallel workers (default: {cpu_count()})')
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview changes without modifying files')
    parser.add_argument('--case-sensitive', action='store_true',
                       help='Case-sensitive matching (default: case-insensitive)')
    parser.add_argument('--no-skip-dirs', action='store_true',
                       help='Process all directories including .git, node_modules, etc')
    parser.add_argument('--verbose', action='store_true',
                       help='Show detailed file-by-file output')
    
    args = parser.parse_args()
    
    # Validate find/replace pairs
    if len(args.find) != len(args.replace):
        print("ERROR: Number of --find and --replace arguments must match!")
        sys.exit(1)
    
    replacements = list(zip(args.find, args.replace))
    root = Path(args.root).resolve()
    
    if not root.exists():
        print(f"ERROR: Root path does not exist: {root}")
        sys.exit(1)
    
    print(f"{'='*80}")
    print(f"SAAAM MASS REPLACER - PRODUCTION MODE")
    print(f"{'='*80}")
    print(f"Root: {root}")
    print(f"Workers: {args.workers}")
    print(f"Extensions: {', '.join(args.ext)}")
    print(f"Replacements:")
    for old, new in replacements:
        print(f"  '{old}' → '{new}'")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"{'='*80}\n")
    
    # Collect files
    print("Scanning directory tree...")
    skip_dirs = set() if args.no_skip_dirs else SKIP_DIRS
    files = collect_files(root, args.ext, skip_dirs)
    
    if not files:
        print("No files found matching criteria!")
        sys.exit(0)
    
    print(f"Found {len(files):,} files to process\n")
    
    # Setup multiprocessing with progress tracking
    manager = Manager()
    progress_queue = manager.Queue()
    tracker = ProgressTracker(len(files))
    
    # Create work items
    work_items = [
        (f, replacements, args.dry_run, args.case_sensitive, progress_queue)
        for f in files
    ]
    
    # Process with worker pool
    print("Processing files...\n")
    results = []
    errors_list = []
    
    with Pool(processes=args.workers) as pool:
        # Start async processing
        async_results = pool.map_async(process_file_wrapper, work_items, chunksize=100)
        
        # Update progress while processing
        while not async_results.ready():
            time.sleep(0.1)
            while not progress_queue.empty():
                modified, count, error = progress_queue.get()
                tracker.update(modified, count, error)
                tracker.print_progress()
        
        # Get final results
        results = async_results.get()
        
        # Process any remaining queue items
        while not progress_queue.empty():
            modified, count, error = progress_queue.get()
            tracker.update(modified, count, error)
    
    # Final progress update
    tracker.print_progress()
    print("\n")
    
    # Collect errors for verbose output
    if args.verbose:
        for modified, count, error, path in results:
            if error:
                errors_list.append((path, error))
            elif modified:
                print(f"✓ {path}: {count} replacements")
    
    # Summary
    elapsed = time.time() - tracker.start_time
    print(f"\n{'='*80}")
    print(f"COMPLETE - {elapsed:.2f}s")
    print(f"{'='*80}")
    print(f"Files processed:  {tracker.processed:,}")
    print(f"Files modified:   {tracker.modified:,}")
    print(f"Total replacements: {tracker.replacements:,}")
    print(f"Errors:           {tracker.errors}")
    print(f"Processing rate:  {tracker.processed/elapsed:.1f} files/second")
    print(f"{'='*80}")
    
    if errors_list and args.verbose:
        print(f"\nErrors encountered:")
        for path, error in errors_list[:20]:  # Show first 20
            print(f"  {path}: {error}")
        if len(errors_list) > 20:
            print(f"  ... and {len(errors_list) - 20} more")
    
    if args.dry_run:
        print("\n⚠️  DRY RUN MODE - No files were actually modified")
        print("Remove --dry-run to apply changes")

if __name__ == '__main__':
    main()
