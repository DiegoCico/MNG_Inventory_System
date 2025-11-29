"""
Lambda handler wrapper for 2404 form generation
Deploy alongside 2404-handler.py
"""
import json
import os
import sys
import importlib.util

def lambda_handler(event, context):
    """
    Simple wrapper that loads and calls 2404-handler.py
    """
    print(f"[2404-wrapper] Received event: {json.dumps(event)}")
    
    # Parse teamId from the direct invocation event
    team_id = event.get('teamId')
    
    if not team_id:
        print("[2404-wrapper] ERROR: teamId is missing")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'ok': False,
                'error': 'teamId is required'
            })
        }
    
    print(f"[2404-wrapper] TeamId: {team_id}")
    
    # Load the actual handler module dynamically
    handler_path = os.path.join(os.path.dirname(__file__), '2404-handler.py')
    spec = importlib.util.spec_from_file_location("handler_2404", handler_path)
    handler = importlib.util.module_from_spec(spec)
    sys.modules['handler_2404'] = handler
    spec.loader.exec_module(handler)
    
    print(f"[2404-wrapper] Calling handler.lambda_handler with wrapped event")
    
    try:
        # Wrap the event to look like API Gateway format
        wrapped_event = {
            'httpMethod': 'POST',
            'body': json.dumps({'teamId': team_id})
        }
        
        result = handler.lambda_handler(wrapped_event, context)
        print(f"[2404-wrapper] Handler returned statusCode: {result.get('statusCode')}")
        print(f"[2404-wrapper] Response body preview: {str(result.get('body'))[:200]}")
        return result
        
    except Exception as e:
        print(f"[2404-wrapper] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({
                'ok': False,
                'error': str(e)
            })
        }